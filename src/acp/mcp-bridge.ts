import type { AgentSideConnection, McpServer, McpServerAcp } from "@agentclientprotocol/sdk";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import {
  type AcpMcpConnection,
  type BridgeCatalog,
  type BridgeLifecycle,
  type BridgeSpawnSettings,
  type BridgeTool,
} from "./mcp-types.js";
import { McpIpcServer } from "./mcp-ipc.js";

const MCP_PROTOCOL_VERSION = "2025-03-26";

/** Sanitize to a deterministic pi-safe tool-name segment. */
function slug(value: string): string {
  const s = value.toLowerCase().replace(/[^a-z0-9_$]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(s) ? s : `_${s || "server"}`;
}

function shortHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 6);
}

/**
 * Session-owned ACP MCP bridge.
 *
 * For each client-provided ACP-transport MCP server (`McpServerAcp`):
 *   mcp/connect { acpId } → connectionId
 *   mcp/message { connectionId, method: "initialize" } → protocol version
 *   mcp/message { connectionId, method: "notifications/initialized" }
 *   mcp/message { connectionId, method: "tools/list" } → remote tool catalog
 *
 * The discovered tools are mapped to deterministic `ide_<server>_<tool>` names
 * and handed to the pi subprocess through a bundled extension over an
 * authenticated local IPC socket. Tool calls flow: pi tool → IPC → bridge →
 * ACP mcp/message tools/call → IntelliJ private MCP session → result.
 */
export class AcpMcpBridge {
  readonly sessionId: string;
  readonly lifecycle: BridgeLifecycle = "idle";
  readonly #conn: AgentSideConnection;
  readonly #servers: McpServer[];
  readonly #connections = new Map<string, AcpMcpConnection>();
  readonly #tools = new Map<string, BridgeTool>();
  #ipc: McpIpcServer | undefined;
  #pending = new Map<string, { connectionId: string; remoteName: string; cancelled: boolean }>();
  #closed = false;
  readonly #discoveryTimeoutMs: number;

  constructor(conn: AgentSideConnection, mcpServers: McpServer[], sessionId: string, discoveryTimeoutMs = 10_000) {
    this.#conn = conn;
    this.#servers = mcpServers;
    this.sessionId = sessionId;
    this.#discoveryTimeoutMs = discoveryTimeoutMs;
  }

  get hasServers(): boolean {
    return this.#servers.some(s => (s as { type?: string }).type === "acp");
  }

  get tools(): BridgeTool[] {
    return [...this.#tools.values()];
  }

  /**
   * Connect every ACP server, discover tools, start IPC, and return spawn
   * settings for the pi subprocess (extension path + private env).
   * Fails only on protocol-invalid responses; an individual server failure
   * omits that server's tools and keeps a diagnostic in startupInfo.
   */
  /** Bounds a single discovery RPC; a silent client must never block session creation. */
  async #withTimeout<T>(label: string, promise: Promise<T>, ms = this.#discoveryTimeoutMs): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async start(): Promise<BridgeSpawnSettings> {
    if (!this.hasServers) {
      return { extensionPaths: [], env: {} };
    }

    const ipc = await McpIpcServer.start(this.sessionId);
    this.#ipc = ipc;
    ipc.onMessage(msg => void this.#handleIpcMessage(msg).catch(err => {
      ipc.send({ type: "error", id: "", code: "bridge_error", message: String(err?.message ?? err) });
    }));
    ipc.onClientClose(() => {
      for (const [id, p] of this.#pending) {
        if (!p.cancelled) ipc.send({ type: "error", id, code: "disconnected", message: "IDE bridge IPC client disconnected" });
      }
      this.#pending.clear();
    });

    const acpServers = this.#servers.filter(
      (s): s is McpServerAcp & { type: "acp" } => (s as { type?: string }).type === "acp",
    );
    const usedNames = new Set<string>();

    for (const server of acpServers) {
      try {
        const response = (await this.#withTimeout(`mcp/connect ${server.name}`, this.#conn.extMethod("mcp/connect", { acpId: server.id }))) as {
          connectionId?: string;
        };
        const connectionId = response?.connectionId;
        if (!connectionId) throw new Error(`mcp/connect returned no connectionId for ${server.name}`);

        this.#connections.set(server.id, {
          acpId: server.id,
          serverName: server.name,
          connectionId,
          state: "ready",
        });

        // MCP initialize over ACP.
        await this.#withTimeout(`initialize ${server.name}`, this.#conn.extMethod("mcp/message", {
          connectionId,
          method: "initialize",
          params: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: "pi-acp", version: "0.0.33" },
          },
        }));
        await this.#withTimeout(`initialized ${server.name}`, this.#conn.extMethod("mcp/message", {
          connectionId,
          method: "notifications/initialized",
          params: {},
        }));

        // Discover remote tools.
        const listResult = (await this.#withTimeout(`tools/list ${server.name}`, this.#conn.extMethod("mcp/message", {
          connectionId,
          method: "tools/list",
          params: {},
        }))) as { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> };
        const remoteTools = Array.isArray(listResult?.tools) ? listResult.tools : [];

        for (const tool of remoteTools) {
          const base = `ide_${slug(server.name)}_${slug(tool.name)}`;
          let exposedName = base;
          if (usedNames.has(exposedName)) {
            exposedName = `${base}_${shortHash(server.id + tool.name)}`;
          }
          usedNames.add(exposedName);
          this.#tools.set(exposedName, {
            exposedName,
            connectionId,
            remoteName: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema ?? {},
          });
        }
      } catch (err) {
        // Omit this server's tools; IDE tools are an optional capability.
        const msg = err instanceof Error ? err.message : String(err);
        this.#diagnostics.push(`IDE bridge: ${server.name} unavailable (${msg})`);
      }
    }

    ipc.setCatalog({ tools: [...this.#tools.values()] });

    const extensionPath = resolveBridgeExtensionPath();
    return {
      extensionPaths: extensionPath ? [extensionPath] : [],
      env: {
        PI_ACP_MCP_IPC_ENDPOINT: ipc.endpoint().endpoint,
        PI_ACP_MCP_IPC_TOKEN: ipc.endpoint().token,
        PI_ACP_MCP_SESSION_ID: this.sessionId,
      },
    };
  }

  /** Wait for the pi extension to connect and authenticate. */
  waitForHandshake(timeoutMs = 20_000): Promise<BridgeCatalog> {
    const ipc = this.#ipc;
    if (!ipc) return Promise.resolve({ tools: [] });
    return Promise.race([
      ipc.waitForHandshake(),
      new Promise<BridgeCatalog>((_, reject) => {
        setTimeout(() => reject(new Error("IDE bridge handshake timed out")), timeoutMs).unref?.();
      }),
    ]);
  }

  get diagnostics(): string[] {
    return [...this.#diagnostics];
  }

  readonly #diagnostics: string[] = [];

  async #handleIpcMessage(msg: import("./mcp-types.js").BridgeIpcMessage): Promise<void> {
    if (msg.type === "call") {
      await this.#callTool(msg.id, msg.tool, msg.args);
      return;
    }
    if (msg.type === "cancel") {
      this.#cancel(msg.id);
      return;
    }
  }

  async #callTool(id: string, exposedName: string, args: Record<string, unknown>): Promise<void> {
    const tool = this.#tools.get(exposedName);
    const ipc = this.#ipc;
    if (!tool || !ipc) {
      ipc?.send({ type: "error", id, code: "unknown_tool", message: "Unknown IDE tool: " + exposedName });
      return;
    }
    if (this.#pending.has(id)) {
      ipc.send({ type: "error", id, code: "duplicate_id", message: "Duplicate request id" });
      return;
    }
    const pending = { connectionId: tool.connectionId, remoteName: tool.remoteName, cancelled: false };
    this.#pending.set(id, pending);
    try {
      const result = await this.#conn.extMethod("mcp/message", {
        connectionId: tool.connectionId,
        method: "tools/call",
        params: { name: tool.remoteName, arguments: args },
      });
      if (pending.cancelled) return; // late result after cancellation: drop
      ipc.send({ type: "result", id, result });
    } catch (err) {
      if (pending.cancelled) return;
      ipc.send({
        type: "error",
        id,
        code: "mcp_error",
        message: err instanceof Error ? err.message : String(err),
        data: err,
      });
    } finally {
      this.#pending.delete(id);
    }
  }

  #cancel(id: string): void {
    const pending = this.#pending.get(id);
    if (!pending) return;
    pending.cancelled = true;
    this.#ipc?.send({ type: "error", id, code: "cancelled", message: "IDE tool call cancelled" });
    // Best-effort MCP cancellation notification; not all clients support it.
    void this.#conn
      .extMethod("mcp/message", {
        connectionId: pending.connectionId,
        method: "notifications/cancelled",
        params: { requestId: id, reason: "cancelled by user" },
      })
      .catch(() => undefined);
  }

  /** Cancel all in-flight tool calls (session/cancel path). Does not close connections. */
  cancelAll(): void {
    for (const id of [...this.#pending.keys()]) this.#cancel(id)
  }

  /** Idempotent: reject pending calls, close IPC, disconnect each ACP server once. */
  async dispose(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#pending.clear();
    this.#ipc?.close();
    this.#ipc = undefined;
    for (const conn of this.#connections.values()) {
      try {
        await this.#conn.extMethod("mcp/disconnect", { connectionId: conn.connectionId });
      } catch {
        // ignore; client may already be gone
      }
    }
    this.#connections.clear();
  }
}

let cachedExtensionPath: string | null | undefined;
function resolveBridgeExtensionPath(): string | null {
  if (cachedExtensionPath !== undefined) return cachedExtensionPath;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // source tree (tsx dev)
    join(here, "..", "pi-extension", "acp-mcp-bridge.ts"),
    // built dist
    join(here, "..", "..", "dist", "pi-extension", "acp-mcp-bridge.js"),
  ];
  cachedExtensionPath = candidates.find(c => existsSync(c)) ?? null;
  return cachedExtensionPath;
}

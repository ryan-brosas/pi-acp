import { createServer, type Socket, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { mkdtempSync, rmSync, chmodSync } from "node:fs";
import {
  BRIDGE_IPC_VERSION,
  BRIDGE_MAX_FRAME_BYTES,
  type BridgeCatalog,
  type BridgeIpcMessage,
} from "./mcp-types.js";

export interface IpcEndpoint {
  /** Path passed to the pi extension via PI_ACP_MCP_IPC_ENDPOINT. */
  endpoint: string;
  token: string;
  sessionId: string;
}

const IPC_HANDSHAKE_TIMEOUT_MS = 20_000;

/**
 * Authenticated local IPC server for the ACP MCP bridge.
 *
 * - Unix domain socket (or named pipe on Windows) in a private temp dir.
 * - Single-client: only the first connection that authenticates with the
 *   per-session token is accepted; further connections are rejected.
 * - Newline-delimited JSON with a 1 MiB frame cap.
 *
 * The catalog is set before the pi child spawns, so the handshake reply
 * (hello_ack) always carries the complete tool catalog.
 */
export class McpIpcServer {
  #server: Server | undefined;
  #endpoint: string;
  #dir: string;
  #token: string;
  #sessionId: string;
  #catalog: BridgeCatalog = { tools: [] };
  #client: Socket | undefined;
  #buffer = "";
  #handshakeResolve: ((catalog: BridgeCatalog) => void) | undefined;
  #handshakeReject: ((err: Error) => void) | undefined;
  #handshakeTimer: NodeJS.Timeout | undefined;
  #authenticated = false;
  #closed = false;
  #onMessage: ((msg: BridgeIpcMessage) => void) | undefined;
  #onClientClose: (() => void) | undefined;

  private constructor(endpoint: string, dir: string, token: string, sessionId: string) {
    this.#endpoint = endpoint;
    this.#dir = dir;
    this.#token = token;
    this.#sessionId = sessionId;
  }

  static async start(sessionId: string): Promise<McpIpcServer> {
    const token = randomBytes(24).toString("hex");
    const dir = mkdtempSync(join(tmpdir(), "pi-acp-mcp-"));
    const endpoint =
      process.platform === "win32"
        ? `\\\\?\\pipe\\pi-acp-mcp-${createHash("sha1").update(sessionId + token).digest("hex").slice(0, 16)}`
        : join(dir, "bridge.sock");
    const server = new McpIpcServer(endpoint, dir, token, sessionId);
    await new Promise<void>((resolve, reject) => {
      const srv = createServer(sock => server.#accept(sock));
      server.#server = srv;
      srv.once("error", reject);
      srv.listen(endpoint, () => {
        srv.off("error", reject);
        if (process.platform !== "win32") {
          try {
            chmodSync(endpoint, 0o600);
          } catch {
            // best effort
          }
        }
        resolve();
      });
    });
    server.#armHandshakeTimeout();
    return server;
  }

  endpoint(): IpcEndpoint {
    return { endpoint: this.#endpoint, token: this.#token, sessionId: this.#sessionId };
  }

  setCatalog(catalog: BridgeCatalog): void {
    this.#catalog = catalog;
    if (this.#authenticated) {
      this.send({ type: "hello_ack", catalog });
    }
  }

  /** Resolves with the catalog once the pi extension authenticates. */
  waitForHandshake(): Promise<BridgeCatalog> {
    return new Promise<BridgeCatalog>((resolve, reject) => {
      this.#handshakeResolve = resolve;
      this.#handshakeReject = reject;
    });
  }

  onMessage(handler: (msg: BridgeIpcMessage) => void): void {
    this.#onMessage = handler;
  }

  onClientClose(handler: () => void): void {
    this.#onClientClose = handler;
  }

  send(msg: BridgeIpcMessage): void {
    const client = this.#client;
    if (!client || client.destroyed) return;
    try {
      client.write(JSON.stringify(msg) + "\n");
    } catch {
      // ignore; client close handling surfaces the failure
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#handshakeTimer) clearTimeout(this.#handshakeTimer);
    this.#handshakeReject?.(new Error("IPC server closed"));
    this.#client?.destroy();
    this.#client = undefined;
    this.#server?.close();
    this.#server = undefined;
    try {
      rmSync(this.#endpoint, { force: true });
      if (this.#dir.startsWith(tmpdir())) rmSync(this.#dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  #armHandshakeTimeout(): void {
    this.#handshakeTimer = setTimeout(() => {
      this.#handshakeReject?.(new Error("IPC handshake timed out: pi extension did not connect"));
      this.#handshakeTimer = undefined;
    }, IPC_HANDSHAKE_TIMEOUT_MS);
    this.#handshakeTimer.unref?.();
  }

  #accept(sock: Socket): void {
    if (this.#client) {
      sock.destroy();
      return;
    }
    this.#client = sock;
    sock.setEncoding("utf8");
    sock.on("data", (chunk: Buffer) => this.#onData(chunk.toString("utf8")));
    sock.on("close", () => {
      if (this.#client === sock) {
        this.#client = undefined;
        this.#authenticated = false;
        this.#onClientClose?.();
      }
    });
    sock.on("error", () => sock.destroy());
  }

  #onData(chunk: string): void {
    this.#buffer += chunk;
    if (Buffer.byteLength(this.#buffer) > BRIDGE_MAX_FRAME_BYTES) {
      this.#client?.destroy();
      return;
    }
    let idx: number;
    while ((idx = this.#buffer.indexOf("\n")) >= 0) {
      const line = this.#buffer.slice(0, idx).trim();
      this.#buffer = this.#buffer.slice(idx + 1);
      if (!line) continue;
      let msg: BridgeIpcMessage;
      try {
        msg = JSON.parse(line) as BridgeIpcMessage;
      } catch {
        this.send({ type: "error", id: "", code: "invalid_frame", message: "Malformed JSON" });
        continue;
      }
      this.#handleMessage(msg);
    }
  }

  #handleMessage(msg: BridgeIpcMessage): void {
    if (msg.type === "hello") {
      if (this.#authenticated) {
        this.send({ type: "error", id: "", code: "already_authenticated", message: "Single client already authenticated" });
        this.#client?.destroy();
        return;
      }
      const version = (msg as { version?: unknown }).version;
      if (version !== BRIDGE_IPC_VERSION) {
        this.send({ type: "error", id: "", code: "version_mismatch", message: "Unsupported IPC version" });
        this.#client?.destroy();
        return;
      }
      if (msg.token !== this.#token || msg.sessionId !== this.#sessionId) {
        this.send({ type: "error", id: "", code: "unauthorized", message: "Invalid token or session id" });
        this.#client?.destroy();
        return;
      }
      this.#authenticated = true;
      if (this.#handshakeTimer) clearTimeout(this.#handshakeTimer);
      this.send({ type: "hello_ack", catalog: this.#catalog });
      this.#handshakeResolve?.(this.#catalog);
      return;
    }
    if (!this.#authenticated) {
      this.send({ type: "error", id: "", code: "unauthorized", message: "Authenticate first" });
      return;
    }
    this.#onMessage?.(msg);
  }
}

export { dirname, basename };

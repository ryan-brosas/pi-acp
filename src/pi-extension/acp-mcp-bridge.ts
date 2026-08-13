/**
 * Bundled pi extension for the ACP MCP bridge (pi-acp).
 *
 * Activated only when PI_ACP_MCP_IPC_ENDPOINT / PI_ACP_MCP_IPC_TOKEN /
 * PI_ACP_MCP_SESSION_ID are present (set by pi-acp when the client provided
 * ACP-transport MCP servers). Connects to the private IPC socket,
 * authenticates, receives the tool catalog, registers each entry as an
 * `ide_*` tool, and forwards calls/cancellation back to pi-acp.
 *
 * Without those env vars this extension is a no-op: ordinary pi behavior.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema } from "typebox";
import { createConnection, type Socket } from "node:net";

const ENDPOINT = process.env.PI_ACP_MCP_IPC_ENDPOINT;
const TOKEN = process.env.PI_ACP_MCP_IPC_TOKEN;
const SESSION_ID = process.env.PI_ACP_MCP_SESSION_ID;
const VERSION = 1;

type CatalogTool = {
  exposedName: string;
  connectionId: string;
  remoteName: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

type IpcMessage =
  | { type: "hello"; version: number; token: string; sessionId: string }
  | { type: "call"; id: string; tool: string; args: Record<string, unknown> }
  | { type: "cancel"; id: string }
  | { type: "hello_ack"; catalog: { tools: CatalogTool[] } }
  | { type: "result"; id: string; result: unknown }
  | { type: "error"; id: string; code: string; message: string };

/** Minimal JSON Schema → TypeBox conversion (best effort; permissive fallback). */
function schemaToTypeBox(schema: Record<string, unknown>): TSchema {
  const t = schema?.type;
  const description = (schema.description as string | undefined) ?? undefined;
  if (t === "string") return Type.String({ description });
  if (t === "number" || t === "integer") return Type.Number({ description });
  if (t === "boolean") return Type.Boolean({ description });
  if (t === "array") return Type.Array(Type.Any());
  if (t === "object" || schema?.properties) {
    const props = (schema.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
    const fields: Record<string, TSchema> = {};
    for (const [key, value] of Object.entries(props)) {
      fields[key] = schemaToTypeBox(value as Record<string, unknown>);
    }
    return Type.Object(fields, { additionalProperties: schema.additionalProperties !== false });
  }
  return Type.Any();
}

export default function acpMcpBridgeExtension(pi: ExtensionAPI): void {
  if (!ENDPOINT || !TOKEN || !SESSION_ID) return;

  let sock: Socket | undefined;
  let buffer = "";
  let registered = false;
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  function send(msg: IpcMessage): void {
    if (!sock || sock.destroyed) return;
    try {
      sock.write(JSON.stringify(msg) + "\n");
    } catch {
      // ignore
    }
  }

  function handleMessage(msg: IpcMessage): void {
    if (msg.type === "hello_ack" && !registered) {
      registered = true;
      registerTools(msg.catalog.tools);
      return;
    }
    if (msg.type === "result") {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.resolve(msg.result);
      }
      return;
    }
    if (msg.type === "error") {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.reject(new Error(msg.message));
      }
      return;
    }
  }

  function registerTools(tools: CatalogTool[]): void {
    for (const tool of tools) {
      const schema = schemaToTypeBox(tool.inputSchema);
      pi.registerTool({
        name: tool.exposedName,
        label: tool.exposedName.replaceAll("_", " "),
        description: tool.description ?? `IDE tool ${tool.remoteName} (via ${tool.connectionId})`,
        parameters: schema as never,
        execute: (async (toolCallId: string, params: unknown, signal?: AbortSignal) => {
          const id = toolCallId;
          return new Promise<{ content: Array<{ type: "text"; text: string }>; details: Record<string, never> }>((resolve, reject) => {
            const onAbort = () => {
              send({ type: "cancel", id });
              failed(new Error("IDE tool call cancelled"));
            };
            const done = (value: unknown) => {
              signal?.removeEventListener("abort", onAbort);
              resolve({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }], details: {} });
            };
            const failed = (err: Error) => {
              signal?.removeEventListener("abort", onAbort);
              reject(err);
            };
            signal?.addEventListener("abort", onAbort, { once: true });
            pending.set(id, { resolve: done, reject: failed });
            send({ type: "call", id, tool: tool.exposedName, args: (params ?? {}) as Record<string, unknown> });
          });
        }) as never,
      });
    }
  }

  function connect(): void {
    if (sock) return;
    sock = createConnection(ENDPOINT!);
    sock.setEncoding("utf8");
    sock.on("connect", () => {
      send({ type: "hello", version: VERSION, token: TOKEN!, sessionId: SESSION_ID! });
    });
    sock.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        let msg: IpcMessage;
        try {
          msg = JSON.parse(line) as IpcMessage;
        } catch {
          continue;
        }
        handleMessage(msg);
      }
    });
    sock.on("close", () => {
      sock = undefined;
      registered = false;
      const err = new Error("IDE bridge IPC disconnected; IDE tools unavailable");
      for (const [, p] of pending) p.reject(err);
      pending.clear();
    });
    sock.on("error", () => sock?.destroy());
  }

  connect();

  pi.on("session_shutdown", () => {
    sock?.destroy();
    sock = undefined;
  });
}

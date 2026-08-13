/**
 * Private types for the ACP MCP bridge (pi-acp → IntelliJ private IJ MCP session).
 * The bridge connects client-provided ACP-transport MCP servers, discovers their
 * tools, and exposes them inside the pi subprocess as `ide_*` tools over an
 * authenticated local IPC channel.
 */

/** One remote tool discovered via MCP tools/list, with its pi-facing name. */
export interface BridgeTool {
  /** Deterministic pi-facing name, e.g. ide_intellij_open_file_in_editor. */
  exposedName: string;
  /** ACP connection id of the owning server. */
  connectionId: string;
  /** Remote tool name as reported by tools/list. */
  remoteName: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/** Immutable catalog handed to the pi extension on handshake. */
export interface BridgeCatalog {
  tools: BridgeTool[];
}

/** Lifecycle of a single ACP-transport MCP connection. */
export type BridgeConnectionState = "connecting" | "ready" | "closed";

export interface AcpMcpConnection {
  acpId: string;
  serverName: string;
  connectionId: string;
  state: BridgeConnectionState;
}

export type BridgeLifecycle = "idle" | "starting" | "ready" | "closing" | "closed";

/** NDJSON messages exchanged with the pi extension over the private socket. */
export type BridgeIpcMessage =
  | { type: "hello"; token: string; sessionId: string }
  | { type: "call"; id: string; tool: string; args: Record<string, unknown> }
  | { type: "cancel"; id: string }
  | { type: "hello_ack"; catalog: BridgeCatalog }
  | { type: "result"; id: string; result: unknown }
  | { type: "error"; id: string; code: string; message: string; data?: unknown }
  | { type: "shutdown" };

/** Spawn settings produced by the bridge and consumed by PiRpcProcess. */
export interface BridgeSpawnSettings {
  extensionPaths: string[];
  env: Record<string, string>;
}

export const BRIDGE_IPC_VERSION = 1;
export const BRIDGE_MAX_FRAME_BYTES = 1024 * 1024;

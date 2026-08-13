/**
 * Private types for the ACP MCP bridge (pi-acp-jetbrain → IntelliJ private IJ MCP session).
 * The bridge connects client-provided ACP and stdio MCP servers and exposes their
 * tools inside the pi subprocess over an authenticated local IPC channel.
 */

/** One remote tool discovered via MCP tools/list, with its pi-facing name. */
export interface BridgeTool {
  /** Deterministic pi-facing name, e.g. ide_intellij_open_file_in_editor. */
  exposedName: string
  /** ACP connection id or bridge-owned stdio id of the owning server. */
  connectionId: string
  /** Remote tool name as reported by tools/list. */
  remoteName: string
  description?: string
  inputSchema: Record<string, unknown>
  /** SHA-256 of the canonical remote input schema. */
  schemaHash?: string
}

/** Immutable catalog handed to the pi extension on handshake. */
export interface BridgeCatalog {
  tools: BridgeTool[]
  /** ACP working directory used as IntelliJ's projectPath when a tool supports it. */
  projectPath?: string
  catalogId?: string
  catalogHash?: string
  complete?: boolean
  diagnostics?: string[]
}

export interface CatalogRegistration {
  catalogId?: string
  registered: Array<{ exposedName: string; schemaHash?: string }>
  failed: Array<{ exposedName: string; schemaHash?: string; message: string }>
  diagnostics?: string[]
}

export type BridgeHealthState =
  | 'catalog_ready'
  | 'registration_complete'
  | 'registration_partial'
  | 'disconnected'
  | 'shutdown'

export interface BridgeHealth {
  state: BridgeHealthState
  catalogId?: string
  diagnostics?: string[]
}

/** MCP result content preserved across the bridge where Pi supports it. */
export type BridgeMcpContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: Record<string, unknown> }
  | { type: 'resource_link'; [key: string]: unknown }
  | { type: string; [key: string]: unknown }

export interface BridgeMcpResult {
  content?: BridgeMcpContent[]
  structuredContent?: unknown
  isError?: boolean
  _meta?: Record<string, unknown>
  [key: string]: unknown
}

/** Lifecycle of a single MCP connection (ACP transport or local stdio). */
export type BridgeConnectionState = 'connecting' | 'ready' | 'closed'

export interface AcpMcpConnection {
  acpId: string
  serverName: string
  connectionId: string
  state: BridgeConnectionState
}

export type BridgeLifecycle = 'idle' | 'starting' | 'ready' | 'closing' | 'closed'

export interface BridgeStatus {
  lifecycle: BridgeLifecycle
  discovered: number
  registered: number
  failed: number
  catalogComplete: boolean
  diagnostics: string[]
}

/** NDJSON messages exchanged with the pi extension over the private socket. */
export type BridgeIpcMessage =
  | { type: 'hello'; version: number; token: string; sessionId: string }
  | { type: 'call'; id: string; tool: string; args: Record<string, unknown> }
  | { type: 'cancel'; id: string }
  | { type: 'hello_ack'; catalog: BridgeCatalog }
  | { type: 'catalog_registered'; registration: CatalogRegistration }
  | { type: 'health'; health: BridgeHealth }
  | { type: 'result'; id: string; result: unknown }
  | { type: 'error'; id: string; code: string; message: string; data?: unknown }
  | { type: 'shutdown'; reason?: string }

/** Spawn settings produced by the bridge and consumed by PiRpcProcess. */
export interface BridgeSpawnSettings {
  extensionPaths: string[]
  env: Record<string, string>
}

export const BRIDGE_IPC_VERSION = 2
export const BRIDGE_MAX_FRAME_BYTES = 1024 * 1024

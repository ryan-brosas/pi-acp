import type { AgentSideConnection, McpServer, McpServerAcp, McpServerStdio } from '@agentclientprotocol/sdk'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  type AcpMcpConnection,
  type BridgeCatalog,
  type BridgeLifecycle,
  type BridgeSpawnSettings,
  type BridgeTool,
  type CatalogRegistration
} from './mcp-types.js'
import { McpIpcServer } from './mcp-ipc.js'
import { StdioMcpClient, type JsonRpcId } from './mcp-stdio.js'

const MCP_PROTOCOL_VERSION = '2025-03-26'
const DEFAULT_DISCOVERY_TIMEOUT_MS = 10_000
const DEFAULT_RUNTIME_TIMEOUT_MS = 120_000
const DEFAULT_MAX_PAGES = 32
const DEFAULT_MAX_TOOLS = 512

export interface AcpMcpBridgeOptions {
  discoveryTimeoutMs?: number
  runtimeTimeoutMs?: number
  maxPages?: number
  maxTools?: number
  /** Working directory for spawned stdio MCP servers. */
  cwd?: string
}

/** Sanitize to a deterministic pi-safe tool-name segment. */
function slug(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9_$]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(s) ? s : `_${s || 'server'}`
}

function shortHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 8)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => canonicalize(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return value
}

function hashJson(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')
}

function isAcpServer(server: McpServer): server is McpServerAcp & { type: 'acp' } {
  return (server as { type?: string }).type === 'acp'
}

function isStdioServer(server: McpServer): server is McpServerStdio {
  const candidate = server as Partial<McpServerStdio>
  return typeof candidate.command === 'string' && Array.isArray(candidate.args) && Array.isArray(candidate.env)
}

type RemoteTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
type RemoteToolsPage = { tools?: RemoteTool[]; nextCursor?: string }

/**
 * Session-owned ACP MCP bridge.
 *
 * IntelliJ currently supplies its private MCP server as a stdio descriptor. The
 * draft ACP MCP transport remains supported for other hosts. Both transports
 * use the same bounded, immutable per-session catalog and Pi IPC adapter.
 */
export class AcpMcpBridge {
  readonly sessionId: string
  #lifecycle: BridgeLifecycle = 'idle'
  readonly #conn: AgentSideConnection
  readonly #servers: McpServer[]
  readonly #connections = new Map<string, AcpMcpConnection>()
  readonly #stdioClients = new Map<string, StdioMcpClient>()
  readonly #tools = new Map<string, BridgeTool>()
  #ipc: McpIpcServer | undefined
  #pending = new Map<
    string,
    { connectionId: string; remoteName: string; remoteRequestId?: JsonRpcId; cancelled: boolean }
  >()
  #closed = false
  readonly #discoveryTimeoutMs: number
  readonly #runtimeTimeoutMs: number
  readonly #maxPages: number
  readonly #maxTools: number
  readonly #cwd: string
  #catalogComplete = true
  readonly #diagnostics: string[] = []

  constructor(
    conn: AgentSideConnection,
    mcpServers: McpServer[],
    sessionId: string,
    options: AcpMcpBridgeOptions | number = {}
  ) {
    const normalized = typeof options === 'number' ? { discoveryTimeoutMs: options } : options
    this.#conn = conn
    this.#servers = mcpServers
    this.sessionId = sessionId
    this.#discoveryTimeoutMs = normalized.discoveryTimeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS
    this.#runtimeTimeoutMs = normalized.runtimeTimeoutMs ?? DEFAULT_RUNTIME_TIMEOUT_MS
    this.#maxPages = Math.max(1, Math.floor(normalized.maxPages ?? DEFAULT_MAX_PAGES))
    this.#maxTools = Math.max(1, Math.floor(normalized.maxTools ?? DEFAULT_MAX_TOOLS))
    this.#cwd = normalized.cwd ?? process.cwd()
  }

  get lifecycle(): BridgeLifecycle {
    return this.#lifecycle
  }

  get hasServers(): boolean {
    return this.#servers.some(server => isAcpServer(server) || isStdioServer(server))
  }

  get tools(): BridgeTool[] {
    return [...this.#tools.values()]
  }

  get projectPath(): string {
    return this.#cwd
  }

  get catalogComplete(): boolean {
    return this.#catalogComplete
  }

  /** Bounds a single discovery or runtime RPC; callers choose the deadline. */
  async #withTimeout<T>(label: string, promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            onTimeout?.()
            reject(new Error(`${label} timed out after ${ms}ms`))
          }, ms)
        })
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  async #discoverTools(serverName: string, requestPage: (cursor?: string) => Promise<unknown>): Promise<RemoteTool[]> {
    const tools: RemoteTool[] = []
    const names = new Set<string>()
    const seenCursors = new Set<string>()
    let cursor: string | undefined

    for (let page = 0; page < this.#maxPages; page++) {
      if (cursor !== undefined) {
        if (seenCursors.has(cursor)) {
          this.#catalogComplete = false
          this.#diagnostics.push(`IDE bridge: ${serverName} repeated tools/list cursor; stopping discovery`)
          return tools
        }
        seenCursors.add(cursor)
      }
      const paramsLabel = cursor ? `tools/list ${serverName} page ${page + 1}` : `tools/list ${serverName}`
      const raw = await this.#withTimeout(paramsLabel, requestPage(cursor), this.#discoveryTimeoutMs)
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error(`${paramsLabel} returned a malformed result`)
      const result = raw as RemoteToolsPage
      if (!Array.isArray(result.tools)) throw new Error(`${paramsLabel} returned no tools array`)

      for (const tool of result.tools) {
        if (!tool || typeof tool.name !== 'string' || tool.name.length === 0) {
          this.#catalogComplete = false
          this.#diagnostics.push(`IDE bridge: ${serverName} returned a tool without a valid name`)
          continue
        }
        if (names.has(tool.name)) {
          this.#diagnostics.push(`IDE bridge: ${serverName} duplicate tool omitted (${tool.name})`)
          continue
        }
        names.add(tool.name)
        tools.push(tool)
        if (tools.length >= this.#maxTools) {
          this.#catalogComplete = false
          this.#diagnostics.push(`IDE bridge: ${serverName} tool catalog truncated at ${this.#maxTools} tools`)
          return tools
        }
      }

      const nextCursor = result.nextCursor
      if (nextCursor === undefined || nextCursor === null || nextCursor === '') return tools
      if (typeof nextCursor !== 'string') {
        this.#catalogComplete = false
        this.#diagnostics.push(`IDE bridge: ${serverName} returned a malformed tools/list cursor`)
        return tools
      }
      cursor = nextCursor
    }

    this.#catalogComplete = false
    this.#diagnostics.push(`IDE bridge: ${serverName} tool catalog truncated at ${this.#maxPages} pages`)
    return tools
  }
  #addTools(server: McpServer, connectionId: string, remoteTools: RemoteTool[], usedNames: Set<string>): void {
    for (const tool of remoteTools) {
      if (this.#tools.size >= this.#maxTools) {
        this.#catalogComplete = false
        this.#diagnostics.push(`IDE bridge: global tool catalog truncated at ${this.#maxTools} tools`)
        return
      }
      const base = `ide_${slug(server.name)}_${slug(tool.name)}`
      let exposedName = base
      if (usedNames.has(exposedName)) {
        exposedName = `${base}_${shortHash(connectionId + tool.name)}`
      }
      usedNames.add(exposedName)
      const inputSchema =
        tool.inputSchema && typeof tool.inputSchema === 'object' && !Array.isArray(tool.inputSchema)
          ? tool.inputSchema
          : {}
      if (tool.inputSchema !== undefined && (typeof tool.inputSchema !== 'object' || Array.isArray(tool.inputSchema))) {
        this.#catalogComplete = false
        this.#diagnostics.push(`IDE bridge: ${server.name} tool schema widened to empty object (${tool.name})`)
      }
      this.#tools.set(exposedName, {
        exposedName,
        connectionId,
        remoteName: tool.name,
        description: tool.description,
        inputSchema,
        schemaHash: hashJson(inputSchema)
      })
    }
  }

  async start(): Promise<BridgeSpawnSettings> {
    if (!this.hasServers) {
      this.#lifecycle = 'ready'
      return { extensionPaths: [], env: {} }
    }
    if (this.#closed) throw new Error('IDE bridge is already closed')
    if (this.#lifecycle !== 'idle') throw new Error(`IDE bridge has already started (${this.#lifecycle})`)
    this.#lifecycle = 'starting'

    const ipc = await McpIpcServer.start(this.sessionId)
    this.#ipc = ipc
    ipc.onMessage(
      msg =>
        void this.#handleIpcMessage(msg).catch(err => {
          ipc.send({ type: 'error', id: '', code: 'bridge_error', message: String(err?.message ?? err) })
        })
    )
    ipc.onClientClose(() => {
      for (const [id, pending] of this.#pending) {
        if (!pending.cancelled)
          ipc.send({ type: 'error', id, code: 'disconnected', message: 'IDE bridge IPC client disconnected' })
      }
      this.#pending.clear()
    })

    const supportedServers = this.#servers.filter(server => isAcpServer(server) || isStdioServer(server))
    const usedNames = new Set<string>()

    for (const [serverIndex, server] of supportedServers.entries()) {
      let connectionId: string | undefined
      let stdioClient: StdioMcpClient | undefined
      try {
        let remoteTools: RemoteTool[]
        if (isAcpServer(server)) {
          const response = (await this.#withTimeout(
            `mcp/connect ${server.name}`,
            this.#conn.extMethod('mcp/connect', { acpId: server.id }),
            this.#discoveryTimeoutMs
          )) as { connectionId?: string }
          connectionId = response?.connectionId
          if (!connectionId) {
            this.#catalogComplete = false
            this.#diagnostics.push(`IDE bridge: ${server.name} unavailable (mcp/connect returned no connectionId)`)
            continue
          }

          this.#connections.set(server.id, { acpId: server.id, serverName: server.name, connectionId, state: 'ready' })
          await this.#withTimeout(
            `initialize ${server.name}`,
            this.#conn.extMethod('mcp/message', {
              connectionId,
              method: 'initialize',
              params: {
                protocolVersion: MCP_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: { name: 'pi-acp', version: '0.0.33' }
              }
            }),
            this.#discoveryTimeoutMs
          )
          await this.#withTimeout(
            `initialized ${server.name}`,
            this.#conn.extNotification('mcp/message', {
              connectionId,
              method: 'notifications/initialized',
              params: {}
            }),
            this.#discoveryTimeoutMs
          )
          remoteTools = await this.#discoverTools(server.name, cursor =>
            this.#conn.extMethod('mcp/message', {
              connectionId,
              method: 'tools/list',
              params: cursor ? { cursor } : {}
            })
          )
        } else {
          stdioClient = await StdioMcpClient.start(server, this.#cwd, message => {
            const note =
              message.method === 'notifications/tools/list_changed'
                ? 'IDE bridge: ' + server.name + ' advertised tools/list_changed; catalog is a session snapshot'
                : 'IDE bridge: ' + server.name + ' sent unsupported MCP notification (' + message.method + ')'
            if (!this.#diagnostics.includes(note)) this.#diagnostics.push(note)
            if (message.method === 'notifications/tools/list_changed') this.#catalogComplete = false
          })
          connectionId = `stdio-${serverIndex}-${shortHash(`${server.name}:${server.command}:${server.args.join('\\0')}`)}`
          this.#stdioClients.set(connectionId, stdioClient)
          await this.#withTimeout(
            `initialize ${server.name}`,
            stdioClient.request(
              'initialize',
              {
                protocolVersion: MCP_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: { name: 'pi-acp', version: '0.0.33' }
              },
              this.#discoveryTimeoutMs
            ),
            this.#discoveryTimeoutMs
          )
          stdioClient.notify('notifications/initialized', {})
          remoteTools = await this.#discoverTools(server.name, cursor =>
            stdioClient!.request('tools/list', cursor ? { cursor } : {}, this.#discoveryTimeoutMs)
          )
        }
        this.#addTools(server, connectionId, remoteTools, usedNames)
      } catch (err) {
        this.#catalogComplete = false
        if (stdioClient && connectionId) {
          this.#stdioClients.delete(connectionId)
          await stdioClient.close()
        }
        if (isAcpServer(server) && connectionId) {
          this.#connections.delete(server.id)
          try {
            await this.#conn.extMethod('mcp/disconnect', { connectionId })
          } catch {
            // The host may already have discarded the failed connection.
          }
        }
        const msg = err instanceof Error ? err.message : String(err)
        this.#diagnostics.push(`IDE bridge: ${server.name} unavailable (${msg})`)
      }
    }

    const extensionPath = resolveBridgeExtensionPath()
    if (!extensionPath) {
      this.#catalogComplete = false
      this.#diagnostics.push('IDE bridge: bundled Pi extension file missing; tools cannot register')
    }

    const tools = [...this.#tools.values()]
    const catalogHash = hashJson(tools)
    const catalogId = `${shortHash(`${this.sessionId}:${catalogHash}`)}-${tools.length}`
    const catalog: BridgeCatalog = {
      tools,
      projectPath: this.#cwd,
      catalogId,
      catalogHash,
      complete: this.#catalogComplete,
      diagnostics: [...this.#diagnostics]
    }
    ipc.setCatalog(catalog)
    this.#lifecycle = 'ready'

    return {
      extensionPaths: extensionPath ? [extensionPath] : [],
      env: {
        PI_ACP_MCP_IPC_ENDPOINT: ipc.endpoint().endpoint,
        PI_ACP_MCP_IPC_TOKEN: ipc.endpoint().token,
        PI_ACP_MCP_SESSION_ID: this.sessionId
      }
    }
  }

  /** Wait for the pi extension to connect and authenticate. */
  waitForHandshake(timeoutMs = 20_000): Promise<BridgeCatalog> {
    const ipc = this.#ipc
    if (!ipc) return Promise.resolve({ tools: [] })
    return Promise.race([
      ipc.waitForHandshake(),
      new Promise<BridgeCatalog>((_, reject) => {
        setTimeout(() => reject(new Error('IDE bridge handshake timed out')), timeoutMs).unref?.()
      })
    ])
  }

  /** Wait for per-tool registration acknowledgement after the Pi child connects. */
  waitForRegistration(timeoutMs = 20_000): Promise<CatalogRegistration> {
    const ipc = this.#ipc
    if (!ipc) return Promise.resolve({ registered: [], failed: [] })
    return Promise.race([
      ipc.waitForRegistration(timeoutMs),
      new Promise<CatalogRegistration>((_, reject) => {
        setTimeout(() => reject(new Error('IDE bridge registration timed out')), timeoutMs).unref?.()
      })
    ])
  }

  ownsConnection(connectionId: string): boolean {
    return [...this.#connections.values()].some(connection => connection.connectionId === connectionId)
  }

  async handleIncomingMcpMessage(params: Record<string, unknown>, notification: boolean): Promise<Record<string, unknown>> {
    const connectionId = params.connectionId
    const method = params.method
    if (typeof connectionId !== 'string' || typeof method !== 'string') {
      throw new Error('Malformed mcp/message parameters')
    }
    if (!this.ownsConnection(connectionId)) {
      throw new Error(`Unknown MCP connection: ${connectionId}`)
    }

    if (method === 'notifications/tools/list_changed') {
      const diagnostic = `IDE bridge: ${connectionId} advertised tools/list_changed; catalog is a session snapshot`
      if (!this.#diagnostics.includes(diagnostic)) this.#diagnostics.push(diagnostic)
    } else {
      const diagnostic = `IDE bridge: unsupported server-originated MCP ${notification ? 'notification' : 'request'} (${method})`
      if (!this.#diagnostics.includes(diagnostic)) this.#diagnostics.push(diagnostic)
    }

    if (notification) return {}
    return {
      error: {
        code: -32601,
        message: `Unsupported server-originated MCP request: ${method}`
      }
    }
  }
  get diagnostics(): string[] {
    return [...this.#diagnostics]
  }

  async #handleIpcMessage(msg: import('./mcp-types.js').BridgeIpcMessage): Promise<void> {
    if (msg.type === 'call') {
      await this.#callTool(msg.id, msg.tool, msg.args)
      return
    }
    if (msg.type === 'cancel') {
      this.#cancel(msg.id)
      return
    }
    if (msg.type === 'health' && msg.health.diagnostics?.length) {
      this.#diagnostics.push(...msg.health.diagnostics)
    }
  }

  async #callTool(id: string, exposedName: string, args: Record<string, unknown>): Promise<void> {
    const tool = this.#tools.get(exposedName)
    const ipc = this.#ipc
    if (!tool || !ipc) {
      ipc?.send({ type: 'error', id, code: 'unknown_tool', message: 'Unknown IDE tool: ' + exposedName })
      return
    }
    if (this.#pending.has(id)) {
      ipc.send({ type: 'error', id, code: 'duplicate_id', message: 'Duplicate request id' })
      return
    }
    const pending: { connectionId: string; remoteName: string; remoteRequestId?: JsonRpcId; cancelled: boolean } = {
      connectionId: tool.connectionId,
      remoteName: tool.remoteName,
      cancelled: false
    }
    this.#pending.set(id, pending)
    try {
      const stdioClient = this.#stdioClients.get(tool.connectionId)
      const result = stdioClient
        ? await stdioClient.request(
            'tools/call',
            { name: tool.remoteName, arguments: args },
            this.#runtimeTimeoutMs,
            undefined,
            remoteRequestId => {
              pending.remoteRequestId = remoteRequestId
            }
          )
        : await this.#withTimeout(
            `tools/call ${tool.remoteName}`,
            this.#conn.extMethod('mcp/message', {
              connectionId: tool.connectionId,
              method: 'tools/call',
              params: { name: tool.remoteName, arguments: args }
            }),
            this.#runtimeTimeoutMs,
            () => this.#cancel(id, 'runtime timeout')
          )
      if (pending.cancelled) return
      ipc.send({ type: 'result', id, result })
    } catch (err) {
      if (pending.cancelled) return
      ipc.send({
        type: 'error',
        id,
        code: 'mcp_error',
        message: err instanceof Error ? err.message : String(err)
      })
    } finally {
      this.#pending.delete(id)
    }
  }

  #cancel(id: string, reason = 'cancelled by user'): void {
    const pending = this.#pending.get(id)
    if (!pending) return
    pending.cancelled = true
    this.#ipc?.send({ type: 'error', id, code: 'cancelled', message: `IDE tool call ${reason}` })
    const stdioClient = this.#stdioClients.get(pending.connectionId)
    if (stdioClient) {
      stdioClient.cancel(pending.remoteRequestId ?? id)
      return
    }
    // ACP extension requests do not expose the inner MCP request id in the
    // installed SDK, so this notification is explicitly best-effort.
    void this.#conn
      .extNotification('mcp/message', {
        connectionId: pending.connectionId,
        method: 'notifications/cancelled',
        params: { requestId: pending.remoteRequestId ?? id, reason }
      })
      .catch(() => undefined)
  }

  /** Cancel all in-flight tool calls (session/cancel path). Does not close connections. */
  cancelAll(): void {
    for (const id of [...this.#pending.keys()]) this.#cancel(id)
  }

  /** Idempotent: reject pending calls, close IPC, disconnect each ACP server once. */
  async dispose(): Promise<void> {
    if (this.#closed) return
    this.#lifecycle = 'closing'
    this.#closed = true
    this.cancelAll()
    this.#pending.clear()
    this.#ipc?.close()
    this.#ipc = undefined
    for (const conn of this.#connections.values()) {
      try {
        await this.#conn.extMethod('mcp/disconnect', { connectionId: conn.connectionId })
      } catch {
        // ignore; client may already be gone
      }
    }
    await Promise.all([...this.#stdioClients.values()].map(client => client.close()))
    this.#stdioClients.clear()
    this.#connections.clear()
    this.#lifecycle = 'closed'
  }
}

let cachedExtensionPath: string | null | undefined
function resolveBridgeExtensionPath(): string | null {
  if (cachedExtensionPath !== undefined) return cachedExtensionPath
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, 'pi-extension', 'acp-mcp-bridge.js'),
    join(here, '..', '..', 'dist', 'pi-extension', 'acp-mcp-bridge.js'),
    join(here, '..', 'pi-extension', 'acp-mcp-bridge.ts')
  ]
  cachedExtensionPath = candidates.find(c => existsSync(c)) ?? null
  return cachedExtensionPath
}

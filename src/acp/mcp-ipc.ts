import { createServer, type Socket, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { randomBytes, createHash } from 'node:crypto'
import { mkdtempSync, rmSync, chmodSync } from 'node:fs'
import {
  BRIDGE_IPC_VERSION,
  BRIDGE_MAX_FRAME_BYTES,
  type BridgeCatalog,
  type BridgeIpcMessage,
  type CatalogRegistration
} from './mcp-types.js'

export interface IpcEndpoint {
  /** Path passed to the pi extension via PI_ACP_MCP_IPC_ENDPOINT. */
  endpoint: string
  token: string
  sessionId: string
}

const IPC_HANDSHAKE_TIMEOUT_MS = 20_000

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
function validateCatalogRegistration(catalog: BridgeCatalog, registration: CatalogRegistration): string | undefined {
  if (!registration || typeof registration !== 'object' || Array.isArray(registration)) {
    return 'Registration acknowledgement is malformed'
  }
  if (!Array.isArray(registration.registered) || !Array.isArray(registration.failed)) {
    return 'Registration acknowledgement must contain registered and failed arrays'
  }
  if (catalog.catalogId !== undefined && registration.catalogId !== catalog.catalogId) {
    return 'Registration acknowledgement catalogId does not match catalog'
  }

  const expected = new Map(catalog.tools.map(tool => [tool.exposedName, tool]))
  const seen = new Set<string>()
  for (const [kind, entries] of [
    ['registered', registration.registered],
    ['failed', registration.failed]
  ] as const) {
    for (const entry of entries) {
      if (!entry || typeof entry.exposedName !== 'string' || entry.exposedName.length === 0) {
        return `Registration acknowledgement contains an invalid ${kind} entry`
      }
      if (!expected.has(entry.exposedName)) {
        return `Registration acknowledgement contains unknown tool ${entry.exposedName}`
      }
      if (seen.has(entry.exposedName)) {
        return `Registration acknowledgement contains duplicate tool ${entry.exposedName}`
      }
      seen.add(entry.exposedName)
      const expectedHash = expected.get(entry.exposedName)?.schemaHash
      if (expectedHash !== undefined && entry.schemaHash !== expectedHash) {
        return `Registration acknowledgement schema hash mismatch for ${entry.exposedName}`
      }
    }
  }

  const missing = [...expected.keys()].filter(name => !seen.has(name))
  return missing.length > 0 ? `Registration acknowledgement omitted tools: ${missing.join(', ')}` : undefined
}
export class McpIpcServer {
  #server: Server | undefined
  readonly #endpoint: string
  readonly #dir: string
  readonly #token: string
  readonly #sessionId: string
  #catalog: BridgeCatalog = { tools: [] }
  #client: Socket | undefined
  #buffer = ''
  #handshakeResolve: ((catalog: BridgeCatalog) => void) | undefined
  #handshakeReject: ((err: Error) => void) | undefined
  #handshakeCatalog: BridgeCatalog | undefined
  #handshakeError: Error | undefined
  #registrationResult: CatalogRegistration | undefined
  #registrationResolve: ((registration: CatalogRegistration) => void) | undefined
  #registrationReject: ((err: Error) => void) | undefined
  #registrationError: Error | undefined
  #handshakeTimer: NodeJS.Timeout | undefined
  #authenticated = false
  #closed = false
  #onMessage: ((msg: BridgeIpcMessage) => void) | undefined
  #onClientClose: (() => void) | undefined

  private constructor(endpoint: string, dir: string, token: string, sessionId: string) {
    this.#endpoint = endpoint
    this.#dir = dir
    this.#token = token
    this.#sessionId = sessionId
  }

  static async start(sessionId: string): Promise<McpIpcServer> {
    const token = randomBytes(24).toString('hex')
    const dir = mkdtempSync(join(tmpdir(), 'pi-acp-mcp-'))
    const endpoint =
      process.platform === 'win32'
        ? `\\\\?\\pipe\\pi-acp-mcp-${createHash('sha1')
            .update(sessionId + token)
            .digest('hex')
            .slice(0, 16)}`
        : join(dir, 'bridge.sock')
    const server = new McpIpcServer(endpoint, dir, token, sessionId)
    await new Promise<void>((resolve, reject) => {
      const srv = createServer(sock => server.#accept(sock))
      server.#server = srv
      srv.once('error', reject)
      srv.listen(endpoint, () => {
        srv.off('error', reject)
        if (process.platform !== 'win32') {
          try {
            chmodSync(endpoint, 0o600)
          } catch {
            // best effort
          }
        }
        resolve()
      })
    })
    server.#armHandshakeTimeout()
    return server
  }

  endpoint(): IpcEndpoint {
    return { endpoint: this.#endpoint, token: this.#token, sessionId: this.#sessionId }
  }

  setCatalog(catalog: BridgeCatalog): void {
    this.#catalog = catalog
    if (this.#authenticated) {
      this.send({ type: 'hello_ack', catalog })
    }
  }

  /** Resolves with the catalog once the pi extension authenticates. */
  waitForHandshake(): Promise<BridgeCatalog> {
    if (this.#handshakeCatalog) return Promise.resolve(this.#handshakeCatalog)
    if (this.#handshakeError) return Promise.reject(this.#handshakeError)
    return new Promise<BridgeCatalog>((resolve, reject) => {
      this.#handshakeResolve = resolve
      this.#handshakeReject = reject
    })
  }

  /** Resolves after the extension has attempted every catalog registration. */
  waitForRegistration(timeoutMs = IPC_HANDSHAKE_TIMEOUT_MS): Promise<CatalogRegistration> {
    if (this.#registrationResult) return Promise.resolve(this.#registrationResult)
    if (this.#handshakeError) return Promise.reject(this.#handshakeError)
    if (this.#registrationError) return Promise.reject(this.#registrationError)
    return new Promise<CatalogRegistration>((resolve, reject) => {
      const timer = setTimeout(() => {
        clear()
        reject(new Error('IPC registration acknowledgement timed out'))
      }, timeoutMs)
      timer.unref?.()
      const resolveRegistration = (value: CatalogRegistration) => {
        clear()
        resolve(value)
      }
      const rejectRegistration = (error: Error) => {
        clear()
        reject(error)
      }
      const clear = () => {
        if (timer) clearTimeout(timer)
        if (this.#registrationResolve === resolveRegistration) {
          this.#registrationResolve = undefined
          this.#registrationReject = undefined
        }
      }
      this.#registrationResolve = resolveRegistration
      this.#registrationReject = rejectRegistration
    })
  }

  onMessage(handler: (msg: BridgeIpcMessage) => void): void {
    this.#onMessage = handler
  }

  onClientClose(handler: () => void): void {
    this.#onClientClose = handler
  }

  send(msg: BridgeIpcMessage): void {
    const client = this.#client
    if (!client || client.destroyed) return
    try {
      client.write(JSON.stringify(msg) + '\n')
    } catch {
      // ignore; client close handling surfaces the failure
    }
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    if (this.#handshakeTimer) clearTimeout(this.#handshakeTimer)
    const error = new Error('IPC server closed')
    this.#handshakeError = error
    this.#handshakeReject?.(error)
    this.#registrationReject?.(error)
    this.#registrationError = error
    this.#handshakeResolve = undefined
    this.#handshakeReject = undefined
    this.#registrationResolve = undefined
    this.#registrationReject = undefined
    this.#client?.destroy()
    this.#client = undefined
    this.#buffer = ''
    this.#server?.close()
    this.#server = undefined
    try {
      rmSync(this.#endpoint, { force: true })
      if (this.#dir.startsWith(tmpdir())) rmSync(this.#dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }

  #armHandshakeTimeout(): void {
    this.#handshakeTimer = setTimeout(() => {
      const error = new Error('IPC handshake timed out: pi extension did not connect')
      this.#handshakeError = error
      this.#handshakeReject?.(error)
      this.#handshakeResolve = undefined
      this.#handshakeReject = undefined
      this.#handshakeTimer = undefined
    }, IPC_HANDSHAKE_TIMEOUT_MS)
    this.#handshakeTimer.unref?.()
  }

  #accept(sock: Socket): void {
    if (this.#client) {
      sock.destroy()
      return
    }
    this.#client = sock
    sock.setEncoding('utf8')
    sock.on('data', (chunk: Buffer) => this.#onData(chunk.toString('utf8')))
    sock.on('close', () => {
      if (this.#client === sock) {
        this.#client = undefined
        this.#authenticated = false
        this.#buffer = ''
        if (!this.#registrationResult) {
          const error = new Error('IPC client disconnected before registration acknowledgement')
          this.#registrationReject?.(error)
          this.#registrationResolve = undefined
          this.#registrationReject = undefined
        }
        this.#onClientClose?.()
      }
    })
    sock.on('error', () => sock.destroy())
  }

  #onData(chunk: string): void {
    this.#buffer += chunk
    if (Buffer.byteLength(this.#buffer) > BRIDGE_MAX_FRAME_BYTES) {
      this.#client?.destroy()
      return
    }
    let idx: number
    while ((idx = this.#buffer.indexOf('\n')) >= 0) {
      const line = this.#buffer.slice(0, idx).trim()
      this.#buffer = this.#buffer.slice(idx + 1)
      if (!line) continue
      let msg: BridgeIpcMessage
      try {
        msg = JSON.parse(line) as BridgeIpcMessage
      } catch {
        this.send({ type: 'error', id: '', code: 'invalid_frame', message: 'Malformed JSON' })
        continue
      }
      this.#handleMessage(msg)
    }
  }

  #handleMessage(msg: BridgeIpcMessage): void {
    if (msg.type === 'hello') {
      if (this.#authenticated) {
        this.send({
          type: 'error',
          id: '',
          code: 'already_authenticated',
          message: 'Single client already authenticated'
        })
        this.#client?.destroy()
        return
      }
      if (msg.version !== BRIDGE_IPC_VERSION) {
        this.send({ type: 'error', id: '', code: 'version_mismatch', message: 'Unsupported IPC version' })
        this.#client?.destroy()
        return
      }
      if (msg.token !== this.#token || msg.sessionId !== this.#sessionId) {
        this.send({ type: 'error', id: '', code: 'unauthorized', message: 'Invalid token or session id' })
        this.#client?.destroy()
        return
      }
      this.#authenticated = true
      this.#handshakeCatalog = this.#catalog
      if (this.#handshakeTimer) clearTimeout(this.#handshakeTimer)
      this.send({ type: 'hello_ack', catalog: this.#catalog })
      this.#handshakeResolve?.(this.#catalog)
      this.#handshakeResolve = undefined
      this.#handshakeReject = undefined
      return
    }
    if (!this.#authenticated) {
      this.send({ type: 'error', id: '', code: 'unauthorized', message: 'Authenticate first' })
      return
    }
    if (msg.type === 'catalog_registered') {
      const mismatch = validateCatalogRegistration(this.#catalog, msg.registration)
      if (mismatch) {
        const error = new Error(mismatch)
        this.#registrationError = error
        this.#registrationReject?.(error)
        this.#registrationResolve = undefined
        this.#registrationReject = undefined
        this.send({ type: 'error', id: '', code: 'catalog_mismatch', message: mismatch })
        return
      }
      this.#registrationResult = msg.registration
      this.#registrationResolve?.(msg.registration)
      this.#registrationResolve = undefined
      this.#registrationReject = undefined
      return
    }
    this.#onMessage?.(msg)
  }
}

export { dirname, basename }

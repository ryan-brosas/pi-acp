import type { JsonRpcId, JsonRpcNotification, JsonRpcMessage, PendingJsonRpcRequest } from './mcp-json-rpc.js'
export type { JsonRpcId, JsonRpcNotification } from './mcp-json-rpc.js'
import { settlePendingJsonRpcResponse } from './mcp-json-rpc.js'

export type SseMcpPhase =
  | 'connect'
  | 'endpoint'
  | 'initialize'
  | 'initialized_notification'
  | 'tools_list'
  | 'runtime_call'
  | 'close'

const DEFAULT_SSE_TIMEOUT_MS = 10_000

export class SseMcpError extends Error {
  readonly phase: SseMcpPhase
  readonly status?: number

  constructor(phase: SseMcpPhase, message: string, opts?: { status?: number }) {
    super(message)
    this.name = 'SseMcpError'
    this.phase = phase
    this.status = opts?.status
  }
}

/**
 * Minimal MCP client over HTTP+SSE (the transport IntelliJ's private MCP
 * server exposes in-process). IntelliJ's stdio descriptor is a launcher
 * script that forwards to the already-running IDE and exits 0, so the bridge
 * falls back to talking to the IDE's SSE endpoint directly when the
 * descriptor carries `IJ_MCP_SERVER_PORT`.
 */
export class SseMcpClient {
  readonly #baseUrl: string
  readonly #authToken: string | undefined
  readonly #controller = new AbortController()
  readonly #pending = new Map<string, PendingJsonRpcRequest>()
  readonly #onNotification: ((message: JsonRpcNotification) => void) | undefined
  #messageUrl: string | undefined
  #closed = false
  #closePromise: Promise<void> | undefined
  #nextId = 1
  #streamDone: Promise<void> | undefined
  #endpointWaiters: Array<() => void> = []

  private constructor(
    port: number,
    options: { authToken?: string; onNotification?: (message: JsonRpcNotification) => void }
  ) {
    this.#baseUrl = `http://127.0.0.1:${port}`
    this.#authToken = options.authToken
    this.#onNotification = options.onNotification
  }

  static async start(
    port: number,
    options: { authToken?: string; onNotification?: (message: JsonRpcNotification) => void } = {}
  ): Promise<SseMcpClient> {
    const client = new SseMcpClient(port, options)
    try {
      await client.#connect()
      return client
    } catch (error) {
      await client.close()
      throw error
    }
  }

  /**
   * Issues a JSON-RPC request. Returns the deferred promise directly (not an
   * async-function wrapper) so stream-end rejections land on the exact promise
   * callers hold — an async wrapper would otherwise produce a transient
   * unhandled rejection during promise adoption.
   */
  request(
    method: string,
    params: unknown,
    timeoutMs: number,
    requestId?: JsonRpcId,
    onRequestId?: (id: JsonRpcId) => void
  ): Promise<unknown> {
    if (this.#closed) return Promise.reject(new SseMcpError('runtime_call', 'MCP SSE server is closed'))
    const id = requestId ?? this.#nextId++
    const key = String(id)
    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.#pending.get(key)
        if (!pending) return
        this.#pending.delete(key)
        void this.notify('notifications/cancelled', {
          requestId: id,
          reason: `${method} timed out after ${timeoutMs}ms`
        })
        reject(new Error(`${method} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      this.#pending.set(key, { resolve, reject, timer })
    })
    onRequestId?.(id)

    void this.#post({ jsonrpc: '2.0', id, method, params })
      .then(post => {
        if (post === undefined) return
        const pending = this.#pending.get(key)
        if (!pending) return
        clearTimeout(pending.timer)
        this.#pending.delete(key)
        if (post.error) {
          pending.reject(new Error(post.error.message ?? `MCP error ${post.error.code ?? 'unknown'}`))
        } else {
          pending.resolve(post.result)
        }
      })
      .catch(error => {
        const pending = this.#pending.get(key)
        if (pending) {
          clearTimeout(pending.timer)
          this.#pending.delete(key)
          pending.reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
    return promise
  }

  async notify(method: string, params: unknown): Promise<void> {
    if (this.#closed) return
    try {
      await this.#post({ jsonrpc: '2.0', method, params })
    } catch {
      // Notifications are best-effort.
    }
  }

  cancel(requestId: JsonRpcId): void {
    if (this.#closed) return
    void this.notify('notifications/cancelled', { requestId, reason: 'cancelled by user' })
    const key = String(requestId)
    const pending = this.#pending.get(key)
    if (!pending) return
    clearTimeout(pending.timer)
    this.#pending.delete(key)
    pending.reject(new Error('MCP request cancelled'))
  }

  async close(): Promise<void> {
    if (this.#closePromise) return this.#closePromise
    this.#closePromise = (async () => {
      this.#closed = true
      this.#controller.abort()
      this.#failPending(new SseMcpError('close', 'MCP SSE server closed'))
      await Promise.race([this.#streamDone ?? await Promise.resolve(), new Promise(resolve => setTimeout(resolve, 500))])
    })()
    return this.#closePromise
  }

  /**
   * IntelliJ's private MCP session runs in restricted mode: every request must
   * carry the per-chat token the IDE ships as the IJ_MCP_AUTH_TOKEN descriptor
   * env var. The server reads that header directly; the standard bearer
   * Authorization form is sent as well for servers that accept either.
   */
  #authHeaders(): Record<string, string> {
    if (!this.#authToken) return {}
    return {
      authorization: `Bearer ${this.#authToken}`,
      IJ_MCP_AUTH_TOKEN: this.#authToken
    }
  }

  /** Connects to /sse and waits for the `endpoint` event announcing the message POST URL. */
  async #connect(): Promise<void> {
    const response = await fetch(`${this.#baseUrl}/sse`, {
      headers: { accept: 'text/event-stream', ...this.#authHeaders() },
      signal: this.#controller.signal
    }).catch(error => {
      if (this.#controller.signal.aborted) throw new SseMcpError('close', 'MCP SSE server closed')
      throw new SseMcpError(
        'connect',
        `MCP SSE connect failed: ${error instanceof Error ? error.message : String(error)}`
      )
    })
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '')
      throw new SseMcpError(
        'connect',
        `MCP SSE endpoint unavailable (HTTP ${response.status}${text ? `; ${text.trim().slice(0, 200)}` : ''})`,
        {
          status: response.status
        }
      )
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const buffer = ''
    this.#streamDone = this.#readStream(reader, decoder, buffer).catch(() => undefined)

    if (!this.#messageUrl) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new SseMcpError('endpoint', 'MCP SSE endpoint event timed out')),
          DEFAULT_SSE_TIMEOUT_MS
        )
        timer.unref?.()
        this.#endpointWaiters.push(() => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }

  async #readStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: { decode(value: Uint8Array, options?: { stream?: boolean }): string },
    initialBuffer: string
  ): Promise<void> {
    let buffer = initialBuffer
    const handle = (block: string) => {
      let event: string | undefined
      const data: string[] = []
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith(':')) continue
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).trim())
      }
      const payload = data.join('\n')
      if (event === 'endpoint') {
        const resolved = new URL(payload, this.#baseUrl)
        if (resolved.hostname !== '127.0.0.1' && resolved.hostname !== 'localhost' && resolved.hostname !== '[::1]') {
          throw new SseMcpError('endpoint', `MCP SSE endpoint event points off-loopback (${resolved.hostname})`)
        }
        this.#messageUrl = resolved.toString()
        for (const resolve of this.#endpointWaiters.splice(0)) resolve()
        return
      }
      if (!payload) return
      let message: JsonRpcMessage
      try {
        message = JSON.parse(payload) as JsonRpcMessage
      } catch {
        return
      }
      this.#handleMessage(message)
    }
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) throw new SseMcpError('close', 'MCP SSE stream ended unexpectedly')
        buffer += decoder.decode(value, { stream: true })
        // The SSE spec permits CRLF, LF, or CR line endings; IntelliJ sends CRLF.
        buffer = buffer.replace(/\r\n|\r/g, '\n')
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          handle(buffer.slice(0, boundary))
          buffer = buffer.slice(boundary + 2)
          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch (error) {
      if (!this.#closed) {
        this.#closed = true
        this.#failPending(error instanceof Error ? error : new Error(String(error)))
      }
      throw error
    }
  }

  #handleMessage(message: JsonRpcMessage): void {
    if (message.method && (message.id === undefined || message.id === null)) {
      this.#onNotification?.({ method: message.method, params: message.params })
      return
    }
    if (message.method && message.id !== undefined && message.id !== null) {
      this.#onNotification?.({ method: message.method, params: message.params, id: message.id })
      void this.#post({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32601, message: `Unsupported MCP server request: ${message.method}` }
      }).catch(() => undefined)
      return
    }
    if (!settlePendingJsonRpcResponse(message, this.#pending)) return
  }

  async #post(message: JsonRpcMessage): Promise<JsonRpcMessage | undefined> {
    if (!this.#messageUrl) throw new SseMcpError('endpoint', 'MCP SSE endpoint event has not arrived')
    const response = await fetch(this.#messageUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.#authHeaders() },
      body: JSON.stringify(message),
      signal: this.#controller.signal
    }).catch(error => {
      if (this.#controller.signal.aborted) throw new SseMcpError('close', 'MCP SSE server closed')
      throw new SseMcpError(
        'runtime_call',
        `MCP SSE POST failed: ${error instanceof Error ? error.message : String(error)}`
      )
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new SseMcpError(
        'runtime_call',
        `MCP SSE POST failed (HTTP ${response.status}${text ? `; ${text.trim().slice(0, 200)}` : ''})`,
        {
          status: response.status
        }
      )
    }
    if (response.status === 202) return undefined
    const text = await response.text()
    if (!text.trim()) return undefined
    try {
      return JSON.parse(text) as JsonRpcMessage
    } catch {
      return undefined
    }
  }

  #failPending(error: Error): void {
    for (const [key, pending] of this.#pending) {
      clearTimeout(pending.timer)
      this.#pending.delete(key)
      pending.reject(error)
    }
  }
}

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import { basename } from 'node:path'
import type { McpServerStdio } from '@agentclientprotocol/sdk'

import type { JsonRpcId, JsonRpcNotification, JsonRpcMessage, PendingJsonRpcRequest } from './mcp-json-rpc.js'
export type { JsonRpcId, JsonRpcNotification } from './mcp-json-rpc.js'
import { settlePendingJsonRpcResponse } from './mcp-json-rpc.js'

export type StdioMcpPhase =
  | 'spawn'
  | 'initialize'
  | 'initialized_notification'
  | 'tools_list'
  | 'runtime_call'
  | 'close'

export class StdioMcpError extends Error {
  readonly phase: StdioMcpPhase
  readonly launchSummary: string
  readonly exitCode?: number
  readonly signal?: NodeJS.Signals
  readonly sanitizedStderr?: string

  constructor(
    phase: StdioMcpPhase,
    message: string,
    opts: { launchSummary: string; exitCode?: number; signal?: NodeJS.Signals; sanitizedStderr?: string }
  ) {
    super(message)
    this.name = 'StdioMcpError'
    this.phase = phase
    this.launchSummary = opts.launchSummary
    this.exitCode = opts.exitCode
    this.signal = opts.signal
    this.sanitizedStderr = opts.sanitizedStderr
  }
}

function launchSummary(server: McpServerStdio, cwd: string): string {
  return `command=${basename(server.command)}; args=${server.args.length}; env=${server.env.length}; cwd=${cwd}`
}

const MAX_STDERR_TAIL = 2_048
const MAX_STDERR_DIAGNOSTIC = 512

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function sanitizeStderr(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/((?:authorization|token|secret|password)[=:]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-MAX_STDERR_DIAGNOSTIC)
}

function exitError(code: number | null, signal: NodeJS.Signals | null, stderr: string, summary: string): StdioMcpError {
  const status = code === null ? `signal=${signal ?? 'unknown'}` : `code=${code}`
  const detail = sanitizeStderr(stderr)
  return new StdioMcpError(
    'spawn',
    `MCP stdio server exited (${status}; ${summary}${detail ? `; stderr: ${detail}` : ''})`,
    {
      launchSummary: summary,
      ...(code === null ? {} : { exitCode: code }),
      ...(signal === null ? {} : { signal }),
      ...(detail ? { sanitizedStderr: detail } : {})
    }
  )
}

/** Minimal MCP stdio client for ACP-provided servers. */
export class StdioMcpClient {
  readonly #child: ChildProcessWithoutNullStreams
  readonly #lines: Interface
  readonly #pending = new Map<string, PendingJsonRpcRequest>()
  readonly #exit: Promise<void>
  #stderrTail = ''
  #nextId = 1
  #closed = false
  #closePromise: Promise<void> | undefined
  readonly #onNotification: ((message: JsonRpcNotification) => void) | undefined
  readonly #launchSummary: string

  private constructor(
    child: ChildProcessWithoutNullStreams,
    launchSummaryText: string,
    onNotification?: (message: JsonRpcNotification) => void
  ) {
    this.#launchSummary = launchSummaryText
    this.#onNotification = onNotification
    this.#child = child
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      this.#stderrTail = `${this.#stderrTail}${String(chunk)}`.slice(-MAX_STDERR_TAIL)
    })
    this.#lines = createInterface({ input: child.stdout })
    this.#lines.on('line', line => this.#handleLine(line))
    this.#exit = new Promise(resolve => {
      child.once('close', (code, signal) => {
        this.#failPending(exitError(code, signal, this.#stderrTail, this.#launchSummary))
        resolve()
      })
      child.once('error', error => this.#failPending(asError(error)))
    })
    child.stdin.on('error', error => this.#failPending(asError(error)))
  }

  static async start(
    server: McpServerStdio,
    cwd = process.cwd(),
    onNotification?: (message: JsonRpcNotification) => void
  ): Promise<StdioMcpClient> {
    const env: NodeJS.ProcessEnv = { ...process.env }
    for (const variable of server.env) env[variable.name] = variable.value

    const summary = launchSummary(server, cwd)
    const child = spawn(server.command, server.args, {
      cwd,
      env,
      stdio: 'pipe',
      shell: process.platform === 'win32' && /\\.(?:cmd|bat)$/i.test(server.command)
    })
    const client = new StdioMcpClient(child, summary, onNotification)
    try {
      await client.#waitForSpawn()
      return client
    } catch (error) {
      await client.close()
      if (error instanceof StdioMcpError) throw error
      throw new StdioMcpError('spawn', `MCP stdio server failed to spawn (${summary})`, {
        launchSummary: summary,
        ...(error instanceof Error ? { cause: error.message } : {})
      } as any)
    }
  }

  async request(
    method: string,
    params: unknown,
    timeoutMs: number,
    requestId?: JsonRpcId,
    onRequestId?: (id: JsonRpcId) => void
  ): Promise<unknown> {
    return this.#request(method, params, timeoutMs, requestId, onRequestId)
  }

  async requestWithId(
    method: string,
    params: unknown,
    timeoutMs: number,
    onRequestId?: (id: JsonRpcId) => void
  ): Promise<{ id: JsonRpcId; result: unknown }> {
    const id = this.#nextId++
    const result = await this.#request(method, params, timeoutMs, id, onRequestId)
    return { id, result }
  }

  notify(method: string, params: unknown): void {
    if (this.#closed) return
    this.#write({ jsonrpc: '2.0', method, params })
  }

  cancel(requestId: JsonRpcId): void {
    if (this.#closed) return
    this.notify('notifications/cancelled', { requestId, reason: 'cancelled by user' })
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
      this.#failPending(new Error('MCP stdio server closed'))
      this.#lines.close()
      if (!this.#child.killed) {
        try {
          this.#child.kill('SIGTERM')
        } catch {
          // The process may have exited between the check and kill.
        }
      }
      await Promise.race([this.#exit, new Promise(resolve => setTimeout(resolve, 1000))])
      if (this.#child.exitCode === null) {
        try {
          this.#child.kill('SIGKILL')
        } catch {
          // Ignore a process that exited during cleanup.
        }
      }
    })()
    return this.#closePromise
  }

  async #request(
    method: string,
    params: unknown,
    timeoutMs: number,
    requestId: JsonRpcId | undefined,
    onRequestId?: (id: JsonRpcId) => void
  ): Promise<unknown> {
    if (this.#closed) throw new Error('MCP stdio server is closed')
    const id = requestId ?? this.#nextId++
    const key = String(id)
    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.#pending.get(key)
        if (!pending) return
        this.#pending.delete(key)
        try {
          this.#write({
            jsonrpc: '2.0',
            method: 'notifications/cancelled',
            params: { requestId: id, reason: `${method} timed out after ${timeoutMs}ms` }
          })
        } catch {
          // The process may have exited while the timeout fired.
        }
        reject(new Error(`${method} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      this.#pending.set(key, { resolve, reject, timer })
    })
    onRequestId?.(id)

    try {
      this.#write({ jsonrpc: '2.0', id, method, params })
    } catch (error) {
      const pending = this.#pending.get(key)
      if (pending) {
        clearTimeout(pending.timer)
        this.#pending.delete(key)
        pending.reject(asError(error))
      }
    }
    return promise
  }

  async #waitForSpawn(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onSpawn = () => {
        this.#child.off('error', onError)
        resolve()
      }
      const onError = (error: Error) => {
        this.#child.off('spawn', onSpawn)
        reject(error)
      }
      this.#child.once('spawn', onSpawn)
      this.#child.once('error', onError)
    })
  }

  #write(message: JsonRpcMessage): void {
    if (this.#closed || this.#child.stdin.destroyed) throw new Error('MCP stdio server is closed')
    this.#child.stdin.write(JSON.stringify(message) + '\n')
  }

  #handleLine(line: string): void {
    if (!line.trim()) return
    let message: JsonRpcMessage
    try {
      message = JSON.parse(line) as JsonRpcMessage
    } catch {
      return
    }
    if (message.method && (message.id === undefined || message.id === null)) {
      this.#onNotification?.({ method: message.method, params: message.params })
      return
    }
    if (message.method && message.id !== undefined && message.id !== null) {
      this.#onNotification?.({ method: message.method, params: message.params, id: message.id })
      try {
        this.#write({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: `Unsupported MCP server request: ${message.method}` }
        })
      } catch {
        // The process may have exited while rejecting the request.
      }
      return
    }
    if (!settlePendingJsonRpcResponse(message, this.#pending)) return
  }

  #failPending(error: Error): void {
    for (const [key, pending] of this.#pending) {
      clearTimeout(pending.timer)
      this.#pending.delete(key)
      pending.reject(error)
    }
  }
}

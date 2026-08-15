// scripts/lib/acp-smoke.mjs
// Shared bounded ACP smoke harness.
//
// One adapter process, line-delimited JSON-RPC parsing, per-request deadlines,
// typed session/update collection, and graceful shutdown. Scripts assert
// semantic outcomes (result vs error envelopes) instead of treating any
// response id as success.

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as setNodeTimeout } from 'node:timers'

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_DEADLINE_MS = 120_000
const GRACE_MS = 5_000

// Entries of the real ~/.pi/agent that stay writable/temp in the overlay so the
// smoke matrix never writes session or cache data into the user's store.
const ISOLATE_TEMP_DIRS = ['sessions', 'cache', 'fabric']

/**
 * Builds an isolated agent dir overlay (F-027): symlink the real pi config so
 * provider auth/models keep working, keep sessions/cache/fabric in a temp dir,
 * and point the adapter session map at the same temp dir.
 */
function createIsolatedAgentEnv() {
  const real = resolve(process.env.HOME ?? '', '.pi', 'agent')
  const base = mkdtempSync(join(tmpdir(), 'pi-acp-smoke-'))
  try {
    for (const name of readdirSync(real)) {
      if (ISOLATE_TEMP_DIRS.includes(name)) continue
      try {
        symlinkSync(join(real, name), join(base, name))
      } catch {
        // best-effort: missing entries or permission quirks are non-fatal
      }
    }
  } catch {
    // real agent dir missing: proceed with an empty overlay
  }
  for (const dir of ISOLATE_TEMP_DIRS) mkdirSync(join(base, dir), { recursive: true })
  return {
    env: {
      PI_CODING_AGENT_DIR: base,
      PI_ACP_SESSION_MAP: join(base, 'pi-acp-session-map.json')
    },
    cleanup: () => {
      try {
        rmSync(base, { recursive: true, force: true })
      } catch {
        // best-effort
      }
    }
  }
}

/** JSON-RPC error surfaced by the adapter (or a harness timeout). */
export class SmokeError extends Error {
  constructor(response, meta) {
    const e = response?.error ?? {}
    const method = meta?.method ?? 'request'
    const id = meta?.id ?? response?.id
    super(`ACP error for ${method} (id ${id}): ${e.code ?? 'unknown'} ${e.message ?? ''}`)
    this.name = 'SmokeError'
    this.code = e.code
    this.messageText = e.message
    this.details = e.data?.details
  }
}

export function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function matches(haystack, re, label) {
  assert(re.test(String(haystack ?? '')), `${label}: expected match ${re} but got ${String(haystack).slice(0, 300)}`)
}

export class SmokeHarness {
  constructor({
    dist = 'dist/index.js',
    cwd = process.cwd(),
    env = {},
    deadlineMs = DEFAULT_DEADLINE_MS,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    isolate = true,
    cleanupIsolation = true
  } = {}) {
    this.dist = resolve(dist)
    this.cwd = cwd
    this.envOverride = env
    this.env = null
    this.isolate = isolate
    this.cleanupIsolation = cleanupIsolation
    this.isolation = null
    this.deadlineMs = deadlineMs
    this.requestTimeoutMs = requestTimeoutMs
    this.child = null
    this.buffer = ''
    this.pending = new Map()
    this.updates = []
    this.stderr = []
    this.exitInfo = null
    this.deadlineTimer = null
    if (!existsSync(this.dist)) {
      throw new Error(`dist not found: ${this.dist} (run \`npm run build\` first)`)
    }
  }

  distHash() {
    return createHash('sha256').update(readFileSync(this.dist, 'utf8')).digest('hex').slice(0, 12)
  }

  start() {
    if (this.child) return this
    // F-027: default dogfood runs against an isolated agent dir so neither the
    // adapter session map nor Pi's session log touches the real user store.
    this.env = { ...process.env }
    if (this.isolate) {
      this.isolation = createIsolatedAgentEnv()
      Object.assign(this.env, this.isolation.env)
    }
    Object.assign(this.env, this.envOverride)
    this.child = spawn(process.execPath, [this.dist], {
      cwd: this.cwd,
      env: this.env,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child.stdout.setEncoding('utf8')
    this.child.stderr.setEncoding('utf8')
    this.child.stdout.on('data', chunk => this._onData(String(chunk)))
    this.child.stderr.on('data', chunk => this.stderr.push(String(chunk)))
    this.child.on('exit', (code, signal) => {
      this.exitInfo = { code, signal }
    })
    this.deadlineTimer = setNodeTimeout(() => {
      this._failAll(`harness deadline (${this.deadlineMs}ms) exceeded`)
    }, this.deadlineMs)
    this.deadlineTimer.unref()
    return this
  }

  _onData(chunk) {
    this.buffer += chunk
    let idx
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (!line) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      this._onMessage(msg)
    }
  }

  _onMessage(msg) {
    if (msg?.id !== undefined) {
      const entry = this.pending.get(msg.id)
      if (entry) {
        this.pending.delete(msg.id)
        clearTimeout(entry.timer)
        if (msg.error) entry.reject(new SmokeError(msg, entry))
        else entry.resolve(msg)
      }
      return
    }
    if (msg?.method === 'session/update') {
      this.updates.push(msg.params?.update ?? msg.params ?? msg)
    }
  }

  request(id, method, params, { timeoutMs = this.requestTimeoutMs } = {}) {
    if (!this.child) throw new Error('harness not started')
    if (this.pending.has(id)) throw new Error(`duplicate request id ${id}`)
    return new Promise((resolvePromise, reject) => {
      const timer = setNodeTimeout(() => {
        this.pending.delete(id)
        reject(
          new SmokeError(
            { id, error: { code: -1, message: `request ${method} timed out after ${timeoutMs}ms` } },
            { method, id }
          )
        )
      }, timeoutMs)
      timer.unref()
      this.pending.set(id, { resolve: resolvePromise, reject, timer, method })
      const payload = params === undefined ? { jsonrpc: '2.0', id, method } : { jsonrpc: '2.0', id, method, params }
      this.child.stdin.write(JSON.stringify(payload) + '\n')
    })
  }

  /** Fire-and-forget JSON-RPC notification (no response id, e.g. session/cancel). */
  notify(method, params) {
    if (!this.child) throw new Error('harness not started')
    const payload = params === undefined ? { jsonrpc: '2.0', method } : { jsonrpc: '2.0', method, params }
    this.child.stdin.write(JSON.stringify(payload) + '\n')
  }

  /** Resolve with the result object; reject on JSON-RPC error or timeout. */
  async expectResult(id, method, params, opts = {}) {
    const resp = await this.request(id, method, params, opts)
    return resp.result
  }

  /** Resolve with the error object; reject if the request succeeds or times out with a different code. */
  async expectError(id, method, params, { code, messagePattern, timeoutMs } = {}) {
    let err
    try {
      await this.request(id, method, params, { timeoutMs })
    } catch (e) {
      err = e
    }
    if (!(err instanceof SmokeError)) {
      throw new Error(`expected JSON-RPC error for ${method} but got a result`)
    }
    if (code !== undefined && err.code !== code) {
      throw new Error(`expected error code ${code} for ${method}, got ${err.code}`)
    }
    if (messagePattern && !messagePattern.test(String(err.messageText ?? ''))) {
      throw new Error(`error message mismatch for ${method}: ${err.messageText}`)
    }
    return err
  }

  waitForUpdate(predicate, { timeoutMs = this.requestTimeoutMs } = {}) {
    const hit = this.updates.find(predicate)
    if (hit) return Promise.resolve(hit)
    return new Promise((resolvePromise, reject) => {
      let interval = null
      const finish = () => {
        if (interval) clearInterval(interval)
      }
      const timer = setNodeTimeout(() => {
        finish()
        reject(new Error(`waitForUpdate timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      timer.unref()
      interval = setInterval(() => {
        const found = this.updates.find(predicate)
        if (found) {
          finish()
          clearTimeout(timer)
          resolvePromise(found)
        }
      }, 25)
    })
  }

  updateTexts() {
    return this.updates.map(u => (u?.content?.type === 'text' ? String(u.content.text) : '')).filter(Boolean)
  }

  async close({ graceMs = GRACE_MS } = {}) {
    if (!this.child) return this.exitInfo
    const child = this.child
    const exited = new Promise(resolvePromise => {
      if (this.exitInfo) return resolvePromise(this.exitInfo)
      child.once('exit', (code, signal) => resolvePromise({ code, signal }))
    })
    child.kill('SIGTERM')
    const winner = await Promise.race([
      exited,
      new Promise(resolvePromise => setTimeout(() => resolvePromise('timeout'), graceMs))
    ])
    if (winner === 'timeout') {
      child.kill('SIGKILL')
      await exited
    }
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer)
    if (this.cleanupIsolation) this.removeIsolation()
    return this.exitInfo
  }

  removeIsolation() {
    if (!this.isolation) return
    this.isolation.cleanup()
    this.isolation = null
  }

  assertExited(expectedCode = 0) {
    if (!this.exitInfo) throw new Error('adapter did not exit (call close() first)')
    const { code, signal } = this.exitInfo
    if (signal) throw new Error(`adapter exited via signal ${signal}, expected code ${expectedCode}`)
    if (code !== expectedCode) throw new Error(`adapter exit code ${code}, expected ${expectedCode}`)
  }

  _failAll(reason) {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.reject(new Error(`${reason} (pending request id ${id}: ${entry.method})`))
    }
    this.pending.clear()
  }
}

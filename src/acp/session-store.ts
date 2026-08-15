import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getPiAcpSessionMapPath } from './paths.js'

export type StoredSession = {
  sessionId: string
  cwd: string
  sessionFile: string
  updatedAt: string
}

type SessionMapFile = {
  version: 1
  sessions: Record<string, StoredSession>
}

const LOCK_RETRY_MS = 10
const LOCK_TIMEOUT_MS = 12_000
const LOCK_STALE_MS = 10_000
const LOCK_SLEEP = new Int32Array(new SharedArrayBuffer(4))

function ensureParentDir(path: string) {
  mkdirSync(dirname(path), { recursive: true })
}

function sleepSync(ms: number): void {
  Atomics.wait(LOCK_SLEEP, 0, 0, ms)
}

function lockIsStale(path: string): boolean {
  try {
    return Date.now() - statSync(path).mtimeMs >= LOCK_STALE_MS
  } catch {
    return false
  }
}

function withFileLock<T>(path: string, operation: () => T): T {
  ensureParentDir(path)
  const lockPath = `${path}.lock`
  const deadline = Date.now() + LOCK_TIMEOUT_MS

  for (;;) {
    try {
      mkdirSync(lockPath, { mode: 0o700 })
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (lockIsStale(lockPath)) {
        rmSync(lockPath, { recursive: true, force: true })
        continue
      }
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for session map lock: ${lockPath}`)
      sleepSync(LOCK_RETRY_MS)
    }
  }

  try {
    return operation()
  } finally {
    rmSync(lockPath, { recursive: true, force: true })
  }
}

function loadFile(path: string): SessionMapFile {
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as SessionMapFile
    if (parsed?.version !== 1 || typeof parsed.sessions !== 'object' || !parsed.sessions) {
      return { version: 1, sessions: {} }
    }
    return parsed
  } catch (e) {
    if (existsSync(path)) {
      process.stderr.write(
        `[pi-acp-jetbrain] session map ${path} is unreadable; starting with an empty map (P2-7 audit): ${e instanceof Error ? e.message : String(e)}\n`
      )
    }
    return { version: 1, sessions: {} }
  }
}

function saveFile(path: string, data: SessionMapFile): void {
  ensureParentDir(path)
  const tmp = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    renameSync(tmp, path)
  } finally {
    rmSync(tmp, { force: true })
  }
}

export class SessionStore {
  private readonly path: string

  constructor(path = getPiAcpSessionMapPath()) {
    this.path = path
  }

  get(sessionId: string): StoredSession | null {
    const db = loadFile(this.path)
    return db.sessions[sessionId] ?? null
  }

  upsert(entry: { sessionId: string; cwd: string; sessionFile: string }): void {
    withFileLock(this.path, () => {
      const db = loadFile(this.path)
      db.sessions[entry.sessionId] = {
        sessionId: entry.sessionId,
        cwd: entry.cwd,
        sessionFile: entry.sessionFile,
        updatedAt: new Date().toISOString()
      }
      saveFile(this.path, db)
    })
  }

  delete(sessionId: string): void {
    withFileLock(this.path, () => {
      const db = loadFile(this.path)
      if (!db.sessions[sessionId]) return
      delete db.sessions[sessionId]
      saveFile(this.path, db)
    })
  }
}

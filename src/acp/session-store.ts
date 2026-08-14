import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
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

function ensureParentDir(path: string) {
  mkdirSync(dirname(path), { recursive: true })
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
  // Atomic write (temp + rename): an interruption or concurrent adapter process
  // cannot truncate or interleave the session map (P2-7 audit).
  const tmp = `${path}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  renameSync(tmp, path)
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
    const db = loadFile(this.path)
    db.sessions[entry.sessionId] = {
      sessionId: entry.sessionId,
      cwd: entry.cwd,
      sessionFile: entry.sessionFile,
      updatedAt: new Date().toISOString()
    }
    saveFile(this.path, db)
  }

  delete(sessionId: string): void {
    const db = loadFile(this.path)
    if (!db.sessions[sessionId]) return
    delete db.sessions[sessionId]
    saveFile(this.path, db)
  }
}

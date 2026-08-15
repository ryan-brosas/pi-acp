import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PiAcpAgent } from '../../src/acp/agent.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

async function withPiAgentDir(root: string, fn: () => Promise<void>): Promise<void> {
  const oldEnv = process.env.PI_CODING_AGENT_DIR
  process.env.PI_CODING_AGENT_DIR = root
  try {
    await fn()
  } finally {
    if (oldEnv === undefined) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = oldEnv
  }
}

test('PiAcpAgent: deleteSession removes stored session and session file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pi-acp-delete-test-'))
  const sessionsDir = join(root, 'sessions', '--tmp--delete-project--')
  const sessionFile = join(sessionsDir, '0000_delete_me.jsonl')
  mkdirSync(sessionsDir, { recursive: true })
  writeFileSync(
    sessionFile,
    '{"type":"session","version":3,"id":"sess-del-store","timestamp":"2026-06-16T00:00:00.000Z","cwd":"/tmp/delete-project"}\n',
    'utf-8'
  )

  await withPiAgentDir(root, async () => {
    const conn = new FakeAgentSideConnection()
    const agent = new PiAcpAgent(asAgentConn(conn))

    const storedSessionId = 'stored-session'
    const storeDeletes: string[] = []

    // Inject a SessionStore that tracks calls.
    ;(agent as any).store = {
      get(sessionId: string) {
        if (sessionId !== storedSessionId) return null
        return { sessionId, cwd: '/tmp/delete-project', sessionFile, updatedAt: new Date().toISOString() }
      },
      delete(sessionId: string) {
        storeDeletes.push(sessionId)
      },
      upsert() {}
    }

    const response = await agent.deleteSession({ sessionId: storedSessionId } as any)
    assert.deepEqual(response, {})
    assert.deepEqual(storeDeletes, [storedSessionId])
    assert.equal(existsSync(sessionFile), false)
  })
})

test('PiAcpAgent: deleteSession finds session via pi discovery when SessionStore misses', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pi-acp-delete-discovery-'))
  const sessionsDir = join(root, 'sessions', '--tmp--delete-discovery--')
  const sessionFile = join(sessionsDir, '0000_pi_discovery.jsonl')
  mkdirSync(sessionsDir, { recursive: true })
  writeFileSync(
    sessionFile,
    JSON.stringify({
      type: 'session',
      version: 3,
      id: 'pi-discovered-session',
      timestamp: '2026-06-16T00:00:00.000Z',
      cwd: '/tmp/delete-discovery'
    }) + '\n',
    'utf-8'
  )

  await withPiAgentDir(root, async () => {
    const conn = new FakeAgentSideConnection()
    const agent = new PiAcpAgent(asAgentConn(conn))

    const storeDeletes: string[] = []

    ;(agent as any).store = {
      get() {
        return null
      },
      delete(sessionId: string) {
        storeDeletes.push(sessionId)
      },
      upsert() {}
    }

    const response = await agent.deleteSession({ sessionId: 'pi-discovered-session' } as any)
    assert.deepEqual(response, {})
    assert.deepEqual(storeDeletes, ['pi-discovered-session'])
    assert.equal(existsSync(sessionFile), false)
  })
})

test('PiAcpAgent: deleteSession succeeds idempotently for unknown sessionId', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pi-acp-delete-unknown-'))
  const sessionsDir = join(root, 'sessions', '--tmp--delete-unknown--')
  mkdirSync(sessionsDir, { recursive: true })

  await withPiAgentDir(root, async () => {
    const conn = new FakeAgentSideConnection()
    const agent = new PiAcpAgent(asAgentConn(conn))

    // Per ACP session/delete semantics, deleting a non-existent session
    // should succeed idempotently (return {} without error).
    const storeDeletes: string[] = []
    ;(agent as any).store = {
      get() {
        return null
      },
      delete(sessionId: string) {
        storeDeletes.push(sessionId)
      },
      upsert() {}
    }

    const response = await agent.deleteSession({ sessionId: 'non-existent-session' } as any)
    assert.deepEqual(response, {})
    assert.deepEqual(storeDeletes, [])
  })
})

test('PiAcpAgent: deleteSession survives missing session file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pi-acp-delete-missingfile-'))
  const sessionsDir = join(root, 'sessions', '--tmp--delete-missingfile--')
  mkdirSync(sessionsDir, { recursive: true })
  const nonExistentFile = join(sessionsDir, '0000_non_existent.jsonl')

  await withPiAgentDir(root, async () => {
    const conn = new FakeAgentSideConnection()
    const agent = new PiAcpAgent(asAgentConn(conn))

    const storeDeletes: string[] = []

    ;(agent as any).store = {
      get(sessionId: string) {
        if (sessionId !== 'missing-file-session') return null
        return {
          sessionId,
          cwd: '/tmp/delete-missingfile',
          sessionFile: nonExistentFile,
          updatedAt: new Date().toISOString()
        }
      },
      delete(sessionId: string) {
        storeDeletes.push(sessionId)
      },
      upsert() {}
    }

    const response = await agent.deleteSession({ sessionId: 'missing-file-session' } as any)
    assert.deepEqual(response, {})
    assert.deepEqual(storeDeletes, ['missing-file-session'])
  })
})

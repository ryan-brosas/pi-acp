import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PiAcpAgent } from '../../src/acp/agent.js'
import { PiRpcProcess } from '../../src/pi-rpc/process.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

function buildAgent(opts: {
  conn?: FakeAgentSideConnection
  stored?: Record<string, unknown> | null
  proc?: Record<string, unknown>
  sessions?: Record<string, unknown>
}) {
  const _conn = opts.conn ?? new FakeAgentSideConnection()
  const agent = new PiAcpAgent(asAgentConn(_conn), {} as any)
  ;(agent as any).sessions = opts.sessions ?? {
    maybeGet: () => undefined,
    getOrCreate: () => ({ sessionId: 'new', touchedFilePaths: new Set() }),
    create: () => ({ sessionId: 'new', touchedFilePaths: new Set() }),
    closeSession: async () => {},
    closeAllExcept: async () => {}
  }
  ;(agent as any).store = {
    get: () => opts.stored ?? null,
    upsert: () => {}
  }
  return { agent, conn: _conn }
}

test('PiAcpAgent: initialize advertises fork/resume/close/providers capabilities', async () => {
  const { agent } = buildAgent({})
  const res = await agent.initialize({ protocolVersion: 1, clientCapabilities: {} } as any)
  assert.deepEqual((res.agentCapabilities as any).sessionCapabilities, {
    list: {},
    delete: {},
    fork: {},
    resume: {},
    close: {}
  })
  assert.deepEqual((res.agentCapabilities as any).providers, {})
})

test('PiAcpAgent: unstable_forkSession loads the source session and forks at the last user message', async () => {
  const conn = new FakeAgentSideConnection()
  const root = mkdtempSync(join(tmpdir(), 'pi-acp-fork-'))
  const srcFile = join(root, 'src.jsonl')
  writeFileSync(srcFile, '{}' + '\n')

  const spawned: Record<string, unknown>[] = []
  const forkCalls: string[] = []
  const upserts: Array<Record<string, unknown>> = []
  const originalSpawn = PiRpcProcess.spawn
  ;(PiRpcProcess as unknown as Record<string, unknown>).spawn = async (params: Record<string, unknown>) => {
    spawned.push(params)
    return {
      onEvent: () => () => {},
      getEntries: async () => ({
        entries: [
          { type: 'message', id: 'u1', parentId: null, timestamp: 't1', message: { role: 'user', content: 'hi' } },
          { type: 'message', id: 'a1', parentId: 'u1', timestamp: 't2', message: { role: 'assistant', content: 'yo' } },
          { type: 'message', id: 'u2', parentId: 'a1', timestamp: 't3', message: { role: 'user', content: 'again' } }
        ],
        leafId: 'u2'
      }),
      fork: async (entryId: string) => {
        forkCalls.push(entryId)
        return { text: 'Forked', cancelled: false }
      },
      getState: async () => ({ sessionId: 'forked-pi-id', sessionFile: '/tmp/pi-acp-fork/branched.jsonl' }),
      getAvailableModels: async () => ({ models: [{ provider: 'openai', id: 'gpt-4o' }] })
    }
  }

  const closed: string[] = []
  const sessions = {
    maybeGet: () => undefined,
    getOrCreate: (sessionId: string) => ({ sessionId, touchedFilePaths: new Set() }),
    closeSession: async () => {},
    closeAllExcept: async (keep: string) => {
      closed.push(keep)
    }
  }

  try {
    const agent = new PiAcpAgent(asAgentConn(conn), {} as any)
    ;(agent as any).sessions = sessions as any
    ;(agent as any).store = {
      get: () => ({ cwd: root, sessionFile: srcFile }),
      upsert: (entry: Record<string, unknown>) => {
        upserts.push(entry)
      }
    }

    const res = await agent.unstable_forkSession({ sessionId: 'src-1', cwd: root, mcpServers: [] } as any)

    // The fork subprocess loads the SOURCE session file (never a copy).
    assert.equal(spawned.length, 1)
    const spawnParams = spawned[0] as Record<string, unknown>
    assert.equal(spawnParams.cwd, root)
    assert.equal(spawnParams.sessionPath, srcFile)
    // Fork happens at the LAST user-message entry (pi RPC fork uses position "before").
    assert.deepEqual(forkCalls, ['u2'])
    // The new ACP session adopts pi's fresh branched session id/file.
    assert.equal(res.sessionId, 'forked-pi-id')
    assert.deepEqual(upserts, [
      { sessionId: 'forked-pi-id', cwd: root, sessionFile: '/tmp/pi-acp-fork/branched.jsonl' }
    ])
    assert.deepEqual((res._meta as any).piAcp.fork, {
      fromSessionId: 'src-1',
      entryId: 'u2',
      text: 'Forked',
      cancelled: false,
      sessionFile: '/tmp/pi-acp-fork/branched.jsonl'
    })
    assert.deepEqual(closed, ['forked-pi-id'])
  } finally {
    PiRpcProcess.spawn = originalSpawn
  }
})

test('PiAcpAgent: unstable_forkSession rejects a source without user messages and cleans up', async () => {
  const conn = new FakeAgentSideConnection()
  const root = mkdtempSync(join(tmpdir(), 'pi-acp-fork-empty-'))
  const srcFile = join(root, 'src.jsonl')
  writeFileSync(srcFile, '{}' + '\n')

  const originalSpawn = PiRpcProcess.spawn
  const disposed: string[] = []
  ;(PiRpcProcess as unknown as Record<string, unknown>).spawn = async () => ({
    onEvent: () => () => {},
    getEntries: async () => ({ entries: [], leafId: null }),
    dispose: () => {
      disposed.push('proc')
    }
  })

  try {
    const agent = new PiAcpAgent(asAgentConn(conn), {} as any)
    ;(agent as any).sessions = {
      maybeGet: () => undefined,
      getOrCreate: (sessionId: string) => ({ sessionId, touchedFilePaths: new Set() }),
      closeSession: async () => {}
    }
    ;(agent as any).store = {
      get: () => ({ cwd: root, sessionFile: srcFile }),
      upsert: () => {}
    }
    ;(agent as any).startBridge = async () => ({
      bridge: { dispose: async () => {} },
      settings: { extensionPaths: [], env: {} }
    })

    await assert.rejects(
      agent.unstable_forkSession({ sessionId: 'src-1', cwd: root, mcpServers: [] } as any),
      /no user messages to fork from/
    )
    assert.deepEqual(disposed, ['proc'])
  } finally {
    PiRpcProcess.spawn = originalSpawn
  }
})

test('PiAcpAgent: unstable_forkSession rejects unknown sessions and relative cwds', async () => {
  const { agent } = buildAgent({ stored: null })
  await assert.rejects(
    agent.unstable_forkSession({ sessionId: 'nope', cwd: '/tmp/x' } as any),
    err => (err as any).data === 'Unknown sessionId: nope'
  )
  await assert.rejects(
    agent.unstable_forkSession({ sessionId: 'x', cwd: 'relative' } as any),
    err => (err as any).data === 'cwd must be an absolute path: relative'
  )
})

test('PiAcpAgent: resumeSession restores the stored session and returns modes/configOptions', async () => {
  const conn = new FakeAgentSideConnection()
  const root = mkdtempSync(join(tmpdir(), 'pi-acp-resume-'))
  const sessionFile = join(root, 'session.jsonl')
  writeFileSync(sessionFile, '{}' + '\n')

  const originalSpawn = PiRpcProcess.spawn
  const spawned: Record<string, unknown>[] = []
  ;(PiRpcProcess as unknown as Record<string, unknown>).spawn = async (params: Record<string, unknown>) => {
    spawned.push(params)
    return {
      onEvent: () => () => {},
      getState: async () => ({}),
      getAvailableModels: async () => ({ models: [{ provider: 'openai', id: 'gpt-4o' }] })
    }
  }

  try {
    const agent = new PiAcpAgent(asAgentConn(conn), {} as any)
    ;(agent as any).sessions = {
      maybeGet: () => undefined,
      getOrCreate: (sessionId: string, params: Record<string, unknown>) => ({
        sessionId,
        cwd: params.cwd,
        proc: params.proc,
        touchedFilePaths: new Set()
      }),
      closeSession: async () => {},
      closeAllExcept: async () => {}
    }
    ;(agent as any).store = {
      get: () => ({ cwd: root, sessionFile }),
      upsert: () => {}
    }

    const res = await agent.resumeSession({ sessionId: 'stored-1', cwd: root, mcpServers: [] } as any)

    assert.equal(spawned.length, 1)
    assert.equal((spawned[0] as Record<string, unknown>).sessionPath, sessionFile)
    assert.ok(Array.isArray((res as any).configOptions))
    assert.ok((res as any).modes)
  } finally {
    PiRpcProcess.spawn = originalSpawn
  }
})

test('PiAcpAgent: resumeSession rejects unknown session ids', async () => {
  const { agent } = buildAgent({ stored: null })
  await assert.rejects(
    agent.resumeSession({ sessionId: 'nope', cwd: '/tmp/x' } as any),
    err => (err as any).data === 'Unknown sessionId: nope'
  )
})

test('PiAcpAgent: closeSession cancels and disposes a live session and is idempotent otherwise', async () => {
  let cancelled = 0
  const closed: string[] = []
  const live = {
    sessionId: 'live-1',
    cancel: async () => {
      cancelled += 1
    }
  }
  const sessions = {
    maybeGet: (id: string) => (id === 'live-1' ? live : undefined),
    closeSession: async (id: string) => {
      closed.push(id)
    }
  }

  const { agent } = buildAgent({ sessions: sessions as any })
  await agent.closeSession({ sessionId: 'live-1' } as any)
  assert.equal(cancelled, 1)
  assert.deepEqual(closed, ['live-1'])

  await agent.closeSession({ sessionId: 'unknown' } as any)
  assert.deepEqual(closed, ['live-1'])
})

test('PiAcpAgent: prompt includes cumulative usage when pi reports session stats', async () => {
  const conn = new FakeAgentSideConnection()
  const promptCalls: string[] = []

  const sessions = {
    maybeGet: () => undefined,
    getOrCreate: (sessionId: string, params: Record<string, unknown>) => ({
      sessionId,
      proc: params.proc,
      touchedFilePaths: new Set(),
      async prompt(message: string) {
        promptCalls.push(message)
        return 'end_turn'
      },
      async cancel() {},
      wasCancelRequested: () => false
    })
  }

  const originalSpawn = PiRpcProcess.spawn
  ;(PiRpcProcess as unknown as Record<string, unknown>).spawn = async () => ({
    onEvent: () => () => {},
    getSessionStats: async () => ({ tokens: { input: 10, output: 5, total: 15 }, cost: 0.5 })
  })

  try {
    const agent = new PiAcpAgent(asAgentConn(conn), {} as any)
    ;(agent as any).sessions = sessions as any
    ;(agent as any).store = {
      get: () => ({ cwd: '/tmp/p', sessionFile: '/tmp/p/s.jsonl' }),
      upsert: () => {}
    }
    ;(agent as any).startBridge = async () => ({
      bridge: { dispose: async () => {} },
      settings: { extensionPaths: [], env: {} }
    })
    ;(agent as any).waitForBridgeReady = async () => {}

    const res = await agent.prompt({ sessionId: 's-1', prompt: [{ type: 'text', text: 'hi' }] } as any)

    assert.equal(res.stopReason, 'end_turn')
    assert.deepEqual(promptCalls, ['hi'])
    assert.deepEqual((res as any).usage, {
      totalTokens: 15,
      inputTokens: 10,
      outputTokens: 5,
      _meta: { piAcp: { cost: 0.5 } }
    })
  } finally {
    PiRpcProcess.spawn = originalSpawn
  }
})

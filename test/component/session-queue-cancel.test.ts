import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpSession } from '../../src/acp/session.js'
import { FakeAgentSideConnection, FakePiRpcProcess, asAgentConn } from '../helpers/fakes.js'

test('PiAcpSession: cancel clears queued prompts', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()

  const session = new PiAcpSession({
    sessionId: 's1',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: []
  })

  const first = session.prompt('one')
  const second = session.prompt('two')
  const third = session.prompt('three')

  // first started, second+third queued
  assert.equal(proc.prompts.length, 1)

  await session.cancel()

  assert.equal(proc.abortCount, 1)

  // Queued prompts should resolve as canceled.
  assert.equal(await second, 'cancelled')
  assert.equal(await third, 'cancelled')

  // Finish the first prompt as canceled after abort.
  proc.emit({ type: 'agent_start' })
  proc.emit({ type: 'turn_end' })
  proc.emit({ type: 'agent_end' })
  proc.emit({ type: 'agent_settled' })
  assert.equal(await first, 'cancelled')

  // queue should have been cleared, so no further prompt started
  assert.equal(proc.prompts.length, 1)
})

test('PiAcpSession: process exit settles the running prompt (P1-1 audit)', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()
  const session = new PiAcpSession({
    sessionId: 's3',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: []
  })

  const turn = session.prompt('one')
  assert.equal(proc.prompts.length, 1)
  proc.exit(1, null)
  assert.equal(await turn, 'error')
  assert.ok(String((session as any).lastError).includes('pi process exited'), 'lastError missing exit diagnostic')
})

test('PiAcpSession: dispose settles the running prompt as cancelled (P1-1 audit)', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()
  const session = new PiAcpSession({
    sessionId: 's4',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: []
  })

  const turn = session.prompt('one')
  await session.dispose()
  assert.equal(await turn, 'cancelled')
})

test('PiAcpSession: cancel cancels the bridge before awaiting the pi abort (P1-2 audit)', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()
  const order: string[] = []
  const bridge = { cancelAll: () => order.push('bridge') }
  ;(proc as any).abort = async () => {
    order.push('proc')
  }

  const session = new PiAcpSession({
    sessionId: 's2',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    bridge: bridge as any,
    fileCommands: []
  })

  const first = session.prompt('one')
  await session.cancel()
  assert.equal(order.join(','), 'bridge,proc')

  proc.emit({ type: 'agent_start' })
  proc.emit({ type: 'turn_end' })
  proc.emit({ type: 'agent_end' })
  proc.emit({ type: 'agent_settled' })
  assert.equal(await first, 'cancelled')
})

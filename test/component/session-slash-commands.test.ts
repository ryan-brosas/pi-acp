import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpSession } from '../../src/acp/session.js'
import { FakeAgentSideConnection, FakePiRpcProcess, asAgentConn } from '../helpers/fakes.js'

async function completePrompt(content: string, prompt: string): Promise<string> {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()
  const session = new PiAcpSession({
    sessionId: 's1',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: [{ name: 'hello', description: '(user)', content, source: '(user)' }]
  })

  const pending = session.prompt(prompt)
  proc.emit({ type: 'agent_start' })
  proc.emit({ type: 'turn_end' })
  proc.emit({ type: 'agent_end' })
  proc.emit({ type: 'agent_settled' })
  assert.equal(await pending, 'end_turn')
  assert.equal(proc.prompts.length, 1)
  return proc.prompts[0]!.message
}

test('PiAcpSession: expands positional prompt arguments before sending to pi', async () => {
  assert.equal(await completePrompt('Expanded $1', '/hello world'), 'Expanded world')
})

test('PiAcpSession: expands $ARGUMENTS before sending to pi', async () => {
  assert.equal(
    await completePrompt('Expanded $ARGUMENTS / ${2:-fallback}', '/hello "wide world" now'),
    'Expanded wide world now / now'
  )
})

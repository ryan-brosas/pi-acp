// Smoke: core ACP handshake + one prompt turn.
// Requires a real model completion for the prompt.
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  assert(typeof created?.sessionId === 'string' && created.sessionId.length > 0, 'missing sessionId')

  // F-010: session/new payload budget; current nominal ~26.8 KB.
  const PAYLOAD_BUDGET = 64_000 // bytes
  const payloadBytes = JSON.stringify(created).length
  assert(payloadBytes <= PAYLOAD_BUDGET, `session/new payload ${payloadBytes} bytes exceeds ${PAYLOAD_BUDGET}`)

  const promptResult = await h.expectResult(
    3,
    'session/prompt',
    { sessionId: created.sessionId, prompt: [{ type: 'text', text: 'Say hello in one short sentence.' }] },
    { timeoutMs: 60_000 }
  )
  assert(promptResult?.stopReason === 'end_turn', `stopReason=${promptResult?.stopReason}`)
  const chunks = h.updates.filter(u => u?.sessionUpdate === 'agent_message_chunk')
  assert(chunks.length > 0, 'no agent_message_chunk updates observed')

  await h.close()
  h.assertExited(0)
  console.log(
    `OK smoke-acp (dist ${h.distHash()}; ${chunks.length} chunks; stopReason ${promptResult.stopReason}; session/new ${payloadBytes} B)`
  )
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-acp: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}

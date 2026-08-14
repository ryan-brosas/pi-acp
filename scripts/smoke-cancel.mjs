// Smoke: session/cancel on the built adapter. Uses a real, long model turn so the
// cancel lands mid-turn; asserts stopReason 'cancelled', no late agent_message_chunk
// after cancel, and that a follow-up prompt still completes (F-018, F-017).
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  assert(typeof created?.sessionId === 'string' && created.sessionId.length > 0, 'missing sessionId')
  const sessionId = created.sessionId

  // Baseline: startup info itself is delivered as an agent_message_chunk, so only
  // chunks arriving after session/new prove the model turn is streaming (P1-5 audit).
  const baseline = h.updates.filter(u => u?.sessionUpdate === 'agent_message_chunk').length

  const slow = h.expectResult(
    3,
    'session/prompt',
    {
      sessionId,
      prompt: [
        {
          type: 'text',
          text: 'Write a detailed essay about the history of the Roman Empire with at least eight paragraphs.'
        }
      ]
    },
    { timeoutMs: 60_000 }
  )
  await h.waitForUpdate(
    () => h.updates.filter(u => u?.sessionUpdate === 'agent_message_chunk').length > baseline,
    { timeoutMs: 30_000 }
  )
  const before = h.updates.filter(u => u?.sessionUpdate === 'agent_message_chunk').length
  assert(before > baseline, 'no model agent_message_chunk observed before cancel')

  h.notify('session/cancel', { sessionId })
  const result = await slow
  assert(result?.stopReason === 'cancelled', `stopReason=${result?.stopReason}, expected cancelled`)

  // Reject late updates: no new agent_message_chunk within 2s of cancellation.
  const afterCancel = h.updates.filter(u => u?.sessionUpdate === 'agent_message_chunk').length
  await new Promise(r => setTimeout(r, 2_000))
  const later = h.updates.filter(u => u?.sessionUpdate === 'agent_message_chunk').length
  assert(later === afterCancel, `late agent_message_chunk after cancel (${afterCancel} -> ${later})`)

  // The session must still accept and complete a new turn. Note: pi's abort lets the
  // in-flight generation finish in the background, so the follow-up can wait as long as
  // the cancelled turn would have run (pi-side semantics; observed ~74s for a long essay).
  const again = await h.expectResult(
    4,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: 'Say hi in one short sentence.' }] },
    { timeoutMs: 120_000 }
  )
  assert(again?.stopReason === 'end_turn', `follow-up prompt stopReason=${again?.stopReason}`)

  await h.close()
  h.assertExited(0)
  console.log(
    `OK smoke-cancel (dist ${h.distHash()}; ${before} chunks before cancel; stopReason cancelled; no late updates; follow-up end_turn)`
  )
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-cancel: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}

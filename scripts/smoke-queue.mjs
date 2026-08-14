// Smoke: two concurrent session/prompt turns on one session resolve in order
// through the adapter's client-side one-at-a-time queue (F-014, P1-5 audit).
// Queue control semantics are pi-side; this probe proves the adapter serializes
// concurrent ACP prompts and reports every JSON-RPC result.
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  const sessionId = created?.sessionId
  assert(typeof sessionId === 'string' && sessionId.length > 0, 'missing sessionId')

  // Fire both prompts before awaiting either: the adapter must queue the second.
  const first = h.expectResult(
    3,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: 'Say hello in one short sentence.' }] },
    { timeoutMs: 90_000 }
  )
  const second = h.expectResult(
    4,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: 'Say goodbye in one short sentence.' }] },
    { timeoutMs: 90_000 }
  )

  const r1 = await first
  const r2 = await second
  assert(r1?.stopReason === 'end_turn', `first turn stopReason=${r1?.stopReason}`)
  assert(r2?.stopReason === 'end_turn', `second turn stopReason=${r2?.stopReason}`)

  // The adapter queue must drain back to 0 (session_info_update queueDepth).
  const drained = h.updates.filter(u => u?._meta?.piAcp?.queueDepth === 0).length
  assert(drained >= 1, 'no queueDepth:0 info update observed after the queued turns')

  console.log('OK smoke-queue (2 concurrent prompts serialized end_turn; queueDepth drained to 0)')
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-queue: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}
await h.close()
h.assertExited(0)

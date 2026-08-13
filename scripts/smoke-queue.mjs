// Smoke: two sequential prompt turns complete with end_turn.
// Queue control semantics are pi-side (see findings F-014); the probe verifies
// the adapter routes both turns and reports every JSON-RPC result.
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  const sessionId = created?.sessionId
  assert(typeof sessionId === 'string' && sessionId.length > 0, 'missing sessionId')

  const r1 = await h.expectResult(
    3,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: '/queue' }] },
    { timeoutMs: 90_000 }
  )
  assert(r1?.stopReason === 'end_turn', `first turn stopReason=${r1?.stopReason}`)
  const r2 = await h.expectResult(
    4,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: '/queue all' }] },
    { timeoutMs: 90_000 }
  )
  assert(r2?.stopReason === 'end_turn', `second turn stopReason=${r2?.stopReason}`)

  console.log('OK smoke-queue (2 turns end_turn; queue control semantics are pi-side, see findings F-014)')
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-queue: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}
await h.close()
h.assertExited(0)

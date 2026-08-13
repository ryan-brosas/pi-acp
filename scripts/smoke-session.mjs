// Smoke: /session slash command renders session statistics.
import { SmokeHarness, assert, matches } from './lib/acp-smoke.mjs'

const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  const r = await h.expectResult(
    3,
    'session/prompt',
    { sessionId: created?.sessionId, prompt: [{ type: 'text', text: '/session' }] },
    { timeoutMs: 60_000 }
  )
  assert(r?.stopReason === 'end_turn', `stopReason=${r?.stopReason}`)
  const text = h.updateTexts().join('\n')
  matches(text, /Session file|Messages:/, '/session output')
  console.log(`OK smoke-session (dist ${h.distHash()}; stats text ${text.length} chars)`)
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-session: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}
await h.close()
h.assertExited(0)

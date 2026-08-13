// Smoke: /changelog slash command round-trips through the adapter.
// A successful exit proves the adapter routed the command and streamed pi's
// reply; the semantic content (changelog vs installation-lookup failure) is
// printed so environment-dependent pi behavior stays visible (findings F-012).
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  const r = await h.expectResult(
    3,
    'session/prompt',
    { sessionId: created?.sessionId, prompt: [{ type: 'text', text: '/changelog' }] },
    { timeoutMs: 60_000 }
  )
  assert(r?.stopReason === 'end_turn', `stopReason=${r?.stopReason}`)
  const text = h.updateTexts().join('\n')
  assert(text.length > 0, 'no assistant text for /changelog')
  const notFound = /couldn't locate pi installation|Changelog not found/i.test(text)
  console.log(
    notFound
      ? 'OK smoke-changelog (adapter round-trip OK; pi reports installation lookup unavailable in this environment)'
      : `OK smoke-changelog (changelog text ${text.length} chars)`
  )
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-changelog: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}
await h.close()
h.assertExited(0)

// Smoke: /compact on a too-small session must surface the adapter's JSON-RPC
// error (expected-negative oracle; the adapter maps pi's failed compact to an
// ACP internal error). Any successful response fails this probe.
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  const err = await h.expectError(
    3,
    'session/prompt',
    { sessionId: created?.sessionId, prompt: [{ type: 'text', text: '/compact Keep it short' }] },
    { code: -32603, messagePattern: /Internal error/ }
  )
  assert(
    typeof err.details === 'string' && /Nothing to compact/.test(err.details),
    `unexpected compact error detail: ${err.details}`
  )
  console.log(
    'OK smoke-compact (expected negative: ACP error -32603, details "Nothing to compact (session too small)")'
  )
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-compact: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}
await h.close()
h.assertExited(0)

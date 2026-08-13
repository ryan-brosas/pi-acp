// Smoke: session/load restores a session created by a previous adapter process.
// Asserts the current LoadSessionResponse contract (object with configOptions,
// models, modes, _meta) and history replay as session/update notifications.
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

let sessionId
const a = new SmokeHarness().start()
try {
  await a.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await a.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  sessionId = created?.sessionId
  assert(typeof sessionId === 'string' && sessionId.length > 0, 'missing sessionId')
  const r = await a.expectResult(
    3,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: 'Hello' }] },
    { timeoutMs: 60_000 }
  )
  assert(r?.stopReason === 'end_turn', `create prompt stopReason=${r?.stopReason}`)
} catch (err) {
  await a.close().catch(() => {})
  console.error(`FAIL smoke-acp-load (create phase): ${err.message}`)
  process.exit(1)
}
await a.close()
a.assertExited(0)

const b = new SmokeHarness().start()
try {
  await b.expectResult(1, 'initialize', { protocolVersion: 1 })
  const loaded = await b.expectResult(
    2,
    'session/load',
    { sessionId, cwd: process.cwd(), mcpServers: [] },
    { timeoutMs: 60_000 }
  )
  assert(loaded !== null && typeof loaded === 'object', 'session/load returned a non-object result')
  for (const key of ['configOptions', 'models', 'modes']) {
    assert(key in loaded, `session/load result missing ${key}`)
  }
  assert(
    loaded._meta?.piAcp?.startupInfo == null,
    `expected null startupInfo on headless load, got ${JSON.stringify(loaded._meta?.piAcp?.startupInfo)}`
  )
  const replay = b.updates.length
  assert(replay > 0, 'session/load did not replay history updates')
  console.log(`OK smoke-acp-load (sessionId ${sessionId}; replay updates ${replay})`)
} catch (err) {
  await b.close().catch(() => {})
  console.error(`FAIL smoke-acp-load (load phase): ${err.message}`)
  process.exit(1)
}
await b.close()
b.assertExited(0)

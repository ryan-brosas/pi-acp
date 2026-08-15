// Smoke: session lifecycle on the built adapter against an isolated agent dir —
// create -> list -> prompt (seed) -> close -> load (replay) -> delete -> delete
// (idempotent) -> list absent, then assert the isolated dir is removed (F-019, F-027).
import { existsSync } from 'node:fs'
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const cwd = process.cwd()
const h1 = new SmokeHarness({ cleanupIsolation: false }).start()
let sessionId = null

async function fail(h, phase, err) {
  await h.close().catch(() => {})
  h1.removeIsolation()
  console.error(`FAIL smoke-lifecycle (${phase}): ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}

try {
  await h1.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h1.expectResult(2, 'session/new', { cwd, mcpServers: [] })
  sessionId = created?.sessionId
  assert(typeof sessionId === 'string' && sessionId.length > 0, 'missing sessionId')

  // Seed the session first so Pi's session JSONL exists before listing (F-019).
  const seeded = await h1.expectResult(
    3,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: 'Say hi in one short sentence.' }] },
    { timeoutMs: 60_000 }
  )
  assert(seeded?.stopReason === 'end_turn', `seed prompt stopReason=${seeded?.stopReason}`)

  const listed = await h1.expectResult(4, 'session/list', {})
  const ids = (listed?.sessions ?? []).map(s => s.sessionId)
  assert(ids.includes(sessionId), `session/list missing the new session ${sessionId}`)

  await h1.close()
  h1.assertExited(0)
} catch (err) {
  await fail(h1, 'phase 1', err)
}

// Phase 2 reuses the same isolated agent dir (kept alive by cleanupIsolation:false).
const h2 = new SmokeHarness({ env: h1.env, isolate: false }).start()
try {
  await h2.expectResult(1, 'initialize', { protocolVersion: 1 })
  const loaded = await h2.expectResult(2, 'session/load', { sessionId, cwd, mcpServers: [] })
  assert(typeof loaded?.configOptions === 'object' && loaded?.configOptions !== null, 'load missing configOptions')
  assert(typeof loaded?.modes === 'object' && loaded?.modes !== null, 'load missing modes')
  assert(Array.isArray(loaded?.modes?.availableModes), 'load modes.availableModes not an array')
  // LoadSessionResponse.models is `{availableModels, currentModelId} | null`.
  assert(
    loaded?.models === null || (typeof loaded?.models === 'object' && Array.isArray(loaded?.models?.availableModels)),
    'load models not in contract shape'
  )
  const replay = h2.updates.filter(u => u?.sessionUpdate === 'agent_message_chunk')
  assert(replay.length > 0, 'no replay agent_message_chunk on load')

  await h2.expectResult(3, 'session/delete', { sessionId })
  const listed2 = await h2.expectResult(4, 'session/list', {})
  const ids2 = (listed2?.sessions ?? []).map(s => s.sessionId)
  assert(!ids2.includes(sessionId), 'session/list still contains the deleted session')

  const del2 = await h2.expectResult(5, 'session/delete', { sessionId }) // idempotent
  assert(JSON.stringify(del2 ?? {}) === '{}', `second delete not idempotent: ${JSON.stringify(del2)}`)

  await h2.close()
  h2.assertExited(0)
  h1.removeIsolation()
  assert(!existsSync(h1.env.PI_CODING_AGENT_DIR), 'isolated agent dir not removed')
  console.log(
    `OK smoke-lifecycle (dist ${h1.distHash()}; create/list/prompt/close/load-replay/delete/idempotent-delete; isolation cleaned)`
  )
} catch (err) {
  await fail(h2, 'phase 2', err)
}

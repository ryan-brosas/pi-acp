// Smoke: ACP gap surface on the built adapter (wave-1 backlog) — session/fork,
// session/resume, session/close, providers/list, and per-turn PromptResponse.usage
// against a seeded session in an isolated agent dir.
import { existsSync } from 'node:fs'
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const cwd = process.cwd()
const h = new SmokeHarness().start()

async function fail(err) {
  await h.close().catch(() => {})
  h.removeIsolation()
  console.error(`FAIL smoke-gaps: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}

try {
  const init = await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const caps = init?.agentCapabilities ?? {}
  const sc = caps.sessionCapabilities ?? {}
  assert(typeof sc.fork === 'object' && sc.fork !== null, 'sessionCapabilities.fork not advertised')
  assert(typeof sc.resume === 'object' && sc.resume !== null, 'sessionCapabilities.resume not advertised')
  assert(typeof sc.close === 'object' && sc.close !== null, 'sessionCapabilities.close not advertised')
  assert(typeof caps.providers === 'object' && caps.providers !== null, 'agentCapabilities.providers not advertised')

  // Seed a real session so pi has a session file with user-message entries.
  const created = await h.expectResult(2, 'session/new', { cwd, mcpServers: [] })
  const sessionId = created?.sessionId
  assert(typeof sessionId === 'string' && sessionId.length > 0, 'missing sessionId')

  const seeded = await h.expectResult(
    3,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: 'Say hi in one short sentence.' }] },
    { timeoutMs: 60_000 }
  )
  assert(seeded?.stopReason === 'end_turn', `seed prompt stopReason=${seeded?.stopReason}`)
  // UNSTABLE PromptResponse.usage sourced from pi get_session_stats.
  assert(typeof seeded?.usage === 'object' && seeded?.usage !== null, 'prompt response missing usage')
  assert(
    typeof seeded.usage.totalTokens === 'number' && seeded.usage.totalTokens > 0,
    `usage.totalTokens=${seeded.usage.totalTokens}`
  )
  assert(typeof seeded.usage.inputTokens === 'number', 'usage.inputTokens not a number')

  // session/fork: pi branches the source into a fresh session file + id.
  const forked = await h.expectResult(
    4,
    'session/fork',
    { sessionId, cwd, mcpServers: [] },
    { timeoutMs: 60_000 }
  )
  const forkedId = forked?.sessionId
  assert(typeof forkedId === 'string' && forkedId.length > 0, 'fork missing sessionId')
  assert(forkedId !== sessionId, `fork returned the source sessionId ${forkedId}`)
  assert(Array.isArray(forked?.configOptions), 'fork missing configOptions array')
  assert(typeof forked?.modes === 'object' && forked?.modes !== null, 'fork missing modes')
  assert(typeof forked?._meta?.piAcp?.fork?.entryId === 'string', 'fork missing _meta.piAcp.fork.entryId')

  // The fork's pi process is live and can answer a prompt on its own branch.
  const forkedPrompt = await h.expectResult(
    5,
    'session/prompt',
    { sessionId: forkedId, prompt: [{ type: 'text', text: 'Continue with one short sentence.' }] },
    { timeoutMs: 60_000 }
  )
  assert(forkedPrompt?.stopReason === 'end_turn', `forked prompt stopReason=${forkedPrompt?.stopReason}`)

  // session/resume: reattach the source session (its subprocess was released by fork).
  const resumed = await h.expectResult(
    6,
    'session/resume',
    { sessionId, cwd, mcpServers: [] },
    { timeoutMs: 60_000 }
  )
  assert(Array.isArray(resumed?.configOptions), 'resume missing configOptions array')
  assert(typeof resumed?.modes === 'object' && resumed?.modes !== null, 'resume missing modes')

  // providers/list from a probe pi process.
  const prov = await h.expectResult(7, 'providers/list', {})
  assert(Array.isArray(prov?.providers) && prov.providers.length > 0, 'providers/list empty')
  for (const p of prov.providers) {
    assert(typeof p?.id === 'string' && p.id.length > 0, 'provider missing id')
    assert(Array.isArray(p?.supported) && p.supported.length > 0, `provider ${p?.id} missing supported`)
  }

  // session/close: cancel + dispose; the stored session stays listable/resumable.
  const closed = await h.expectResult(8, 'session/close', { sessionId: forkedId })
  assert(closed === undefined || typeof closed === 'object', `unexpected close result ${JSON.stringify(closed)}`)

  const listed = await h.expectResult(9, 'session/list', {})
  const ids = (listed?.sessions ?? []).map(s => s.sessionId)
  assert(ids.includes(sessionId), 'session/list missing source session after close')
  assert(ids.includes(forkedId), 'session/list missing forked session after close')

  await h.expectResult(10, 'session/delete', { sessionId })
  await h.expectResult(11, 'session/delete', { sessionId: forkedId })

  await h.close()
  h.assertExited(0)
  h.removeIsolation()
  assert(!existsSync(h.env.PI_CODING_AGENT_DIR), 'isolated agent dir not removed')
  console.log(`OK smoke-gaps (dist ${h.distHash()}; fork/resume/close/providers/usage; isolation cleaned)`)
} catch (err) {
  await fail(err)
}
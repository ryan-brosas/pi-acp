// Smoke: ACP protocol negative cases against the built adapter (F-020).
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })

  // Unknown session id: prompt and load must reject with invalidParams.
  const p1 = await h.expectError(
    2,
    'session/prompt',
    { sessionId: 'does-not-exist-xyz', prompt: [{ type: 'text', text: 'hi' }] },
    { code: -32602 }
  )
  assert(p1.code === -32602, `prompt unknown session code ${p1.code}`)
  const p2 = await h.expectError(
    3,
    'session/load',
    { sessionId: 'does-not-exist-xyz', cwd: process.cwd(), mcpServers: [] },
    { code: -32602 }
  )
  assert(p2.code === -32602, `load unknown session code ${p2.code}`)

  // Relative cwd on load must reject with invalidParams.
  const p3 = await h.expectError(
    4,
    'session/load',
    { sessionId: 'does-not-exist-xyz', cwd: 'relative/path', mcpServers: [] },
    { code: -32602 }
  )
  assert(p3.code === -32602, `load relative cwd code ${p3.code}`)

  // Cancel on an unknown session is a no-op notification.
  h.notify('session/cancel', { sessionId: 'does-not-exist-xyz' })
  await new Promise(r => setTimeout(r, 300))

  // Delete on an unknown session is idempotent success.
  const del = await h.expectResult(5, 'session/delete', { sessionId: 'does-not-exist-xyz' })
  assert(JSON.stringify(del ?? {}) === '{}', `delete unknown session not idempotent: ${JSON.stringify(del)}`)

  // initialize with an unsupported protocol version clamps to 1 (no error).
  const init2 = await h.expectResult(6, 'initialize', { protocolVersion: 999 })
  assert(init2?.protocolVersion === 1, `protocolVersion clamp=${init2?.protocolVersion}`)

  // session/list with a bogus cursor degrades to the first page.
  const list = await h.expectResult(7, 'session/list', { cursor: 'bogus' })
  assert(Array.isArray(list?.sessions), 'session/list sessions not an array')

  await h.close()
  h.assertExited(0)
  console.log(
    `OK smoke-negative (dist ${h.distHash()}; cases: unknown prompt/load, relative cwd, cancel no-op, idempotent delete, version clamp, bogus cursor)`
  )
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-negative: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}

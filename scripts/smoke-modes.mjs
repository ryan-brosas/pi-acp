// Smoke: session/set_mode emits current_mode_update and config_option_update.
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  assert(typeof created?.sessionId === 'string', 'missing sessionId')

  await h.expectResult(3, 'session/set_mode', { sessionId: created.sessionId, modeId: 'low' }, { timeoutMs: 30_000 })
  await h.waitForUpdate(u => u?.sessionUpdate === 'current_mode_update', { timeoutMs: 15_000 })
  await h.waitForUpdate(u => u?.sessionUpdate === 'config_option_update', { timeoutMs: 15_000 })

  console.log('OK smoke-modes (current_mode_update + config_option_update observed)')
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-modes: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}
await h.close()
h.assertExited(0)

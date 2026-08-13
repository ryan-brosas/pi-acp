// Smoke: /export produces a verifiable HTML artifact after a seeded turn.
// pi streams 'Session exported: ' and the path separately, so the probe detects
// newly created pi-session-*.html files in cwd, verifies content, and cleans up.
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const EXPORT_PATTERN = /^pi-session-.*\.html$/

const before = readdirSync(process.cwd()).filter(f => EXPORT_PATTERN.test(f))
const h = new SmokeHarness().start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(2, 'session/new', { cwd: process.cwd(), mcpServers: [] })
  const sessionId = created?.sessionId
  assert(typeof sessionId === 'string', 'missing sessionId')

  const seed = await h.expectResult(
    3,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: 'Say hi in one short sentence.' }] },
    { timeoutMs: 60_000 }
  )
  assert(seed?.stopReason === 'end_turn', `seed turn stopReason=${seed?.stopReason}`)
  const exp = await h.expectResult(
    4,
    'session/prompt',
    { sessionId, prompt: [{ type: 'text', text: '/export' }] },
    { timeoutMs: 60_000 }
  )
  assert(exp?.stopReason === 'end_turn', `export turn stopReason=${exp?.stopReason}`)

  const after = readdirSync(process.cwd()).filter(f => EXPORT_PATTERN.test(f))
  const artifacts = after.filter(f => !before.includes(f))
  assert(artifacts.length > 0, `no pi-session-*.html artifact created by /export (existing: ${JSON.stringify(before)})`)
  const p = join(process.cwd(), artifacts[0])
  assert(existsSync(p), `exported file not found: ${p}`)
  const content = readFileSync(p, 'utf8')
  assert(content.includes('<!DOCTYPE html>'), 'exported HTML missing doctype')
  assert(content.includes('Session Export'), 'exported HTML missing session export title')
  assert(content.length > 1_000, `exported HTML suspiciously small (${content.length} bytes)`)
  unlinkSync(p)
  console.log(`OK smoke-export (artifact ${p} verified and cleaned up)`)
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-export: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
}
await h.close()
h.assertExited(0)

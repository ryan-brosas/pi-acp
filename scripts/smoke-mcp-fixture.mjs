// Smoke: non-empty MCP descriptor end to end against the built adapter (F-006,
// F-021, F-028). Spawns a fake stdio MCP server via session/new.mcpServers,
// asserts bridge discovery/registration surfaces in startupInfo, that the
// descriptor secret never leaks to adapter stderr, and that a real model turn
// can invoke the bridged tool through the full IPC path.
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SmokeHarness, assert, matches } from './lib/acp-smoke.mjs'

const fixturePath = fileURLToPath(new URL('./fixtures/fake-mcp-server.mjs', import.meta.url))
const work = mkdtempSync(join(tmpdir(), 'pi-acp-mcp-fixture-'))
const logPath = join(work, 'server.log')
const secret = 'sk-sentinel-0123456789012345678901234567890123456789'

function serverLog() {
  if (!existsSync(logPath)) return []
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

async function waitForLog(predicate, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (serverLog().some(predicate)) return true
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error(`timed out waiting for ${label}`)
}

const h = new SmokeHarness({ env: { PI_ACP_DEBUG_BRIDGE: '1', FAKE_MCP_LOG: logPath } }).start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(
    2,
    'session/new',
    {
      cwd: process.cwd(),
      mcpServers: [
        {
          type: 'stdio',
          name: 'fixture',
          command: process.execPath,
          args: [fixturePath],
          env: [
            { name: 'FAKE_MCP_LOG', value: logPath },
            { name: 'FAKE_SECRET', value: secret }
          ]
        }
      ]
    },
    { timeoutMs: 60_000 }
  )
  const sessionId = created?.sessionId
  assert(typeof sessionId === 'string' && sessionId.length > 0, 'missing sessionId')

  const startupInfo = created?._meta?.piAcp?.startupInfo ?? ''
  matches(startupInfo, /## IDE Tools/, 'startupInfo IDE Tools section')
  matches(startupInfo, /1 tool registered/, 'startupInfo reports the registered bridge tool')
  matches(startupInfo, /echo/, 'startupInfo lists the bridged tool')

  // The fake server must have been discovered (initialize + tools/list).
  await waitForLog(m => m?.type === 'received' && m.method === 'tools/list', 'tools/list discovery', 20_000)

  // Real model turn invoking the bridged tool through the adapter+pi IPC path.
  const r = await h.expectResult(
    3,
    'session/prompt',
    {
      sessionId,
      prompt: [
        {
          type: 'text',
          text: 'Use the ide_fixture_echo tool with value "hello" and reply with exactly its output.'
        }
      ]
    },
    { timeoutMs: 120_000 }
  )
  assert(r?.stopReason === 'end_turn', `tool-call turn stopReason=${r?.stopReason}`)
  await waitForLog(m => m?.type === 'call' && m.name === 'echo', 'tools/call invocation', 30_000)

  // F-028: the descriptor secret must never reach adapter stderr; env values
  // must be redacted in the PI_ACP_DEBUG_BRIDGE dump.
  const stderr = h.stderr.join('\n')
  assert(!stderr.includes(secret), 'descriptor secret leaked to adapter stderr')
  assert(stderr.includes('[redacted '), 'descriptor env values not redacted in the debug dump')

  await h.close()
  h.assertExited(0)
  console.log(
    `OK smoke-mcp-fixture (dist ${h.distHash()}; server discovered; ide_fixture_echo registered and invoked; descriptor secret redacted)`
  )
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-mcp-fixture: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
} finally {
  try {
    rmSync(work, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

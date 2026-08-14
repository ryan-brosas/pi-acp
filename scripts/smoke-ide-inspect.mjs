// Smoke: adapter-enforced post-turn IDE inspection (F-021/F-030). Spawns the
// built adapter with a fake MCP server exposing lint_files, points the session
// at a temp git repo with one modified file, runs a trivial model turn, and
// asserts the gate invoked lint_files, persisted a report, surfaced a summary,
// and recorded the outcome in PromptResponse._meta.
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { SmokeHarness, assert } from './lib/acp-smoke.mjs'

const fixturePath = fileURLToPath(new URL('./fixtures/fake-mcp-inspect.mjs', import.meta.url))
const work = mkdtempSync(join(tmpdir(), 'pi-acp-ide-inspect-'))
const logPath = join(work, 'server.log')
const repo = join(work, 'repo')

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

async function waitForLog(predicate, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (serverLog().some(predicate)) return true
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error(`timed out waiting for ${label}`)
}

// Temp git repo with one tracked file, then a modification the gate should see.
mkdirSync(repo, { recursive: true })
const git = args => spawnSync('git', args, { cwd: repo, encoding: 'utf-8' })
git(['init', '-q'])
git(['config', 'user.email', 't@example.com'])
git(['config', 'user.name', 'T'])
writeFileSync(join(repo, 'sample.ts'), 'export const sample = 1\n')
git(['add', 'sample.ts'])
git(['commit', '-qm', 'init'])
writeFileSync(join(repo, 'sample.ts'), 'export const sample = 2\n')
mkdirSync(join(repo, 'inspections'), { recursive: true })
writeFileSync(join(repo, 'inspections', 'no-any.inspection.kts'), "import com.intellij.psi.*\n\n// Flags declared 'any' types (annotations, parameters, generics) but allows\n// `as any` casts on untyped external data, per AGENTS.md.\nval declaredAnyInspection = localInspection { psiFile, inspection ->\n    psiFile.descendants()\n        .filter { it.text == \"any\" && it.javaClass.simpleName != \"LeafPsiElement\" }\n        .filter { node ->\n            node.parents(withSelf = false).none { p -> p.javaClass.simpleName == \"TypeScriptAsExpressionImpl\" }\n        }\n        .forEach { inspection.registerProblem(it, \"Avoid declaring 'any' — use an explicit type or unknown\") }\n}\n\nlistOf(\n    InspectionKts(\n        id = \"no-declared-any-ts\",\n        localTool = declaredAnyInspection,\n        name = \"No declared any in TypeScript\",\n        htmlDescription = \"Avoid declared 'any' types; 'as any' casts for untyped external data are allowed.\",\n        level = HighlightDisplayLevel.WARNING\n    )\n)\n")


const h = new SmokeHarness({ env: { PI_ACP_DEBUG_BRIDGE: '1', FAKE_MCP_LOG: logPath } }).start()
try {
  await h.expectResult(1, 'initialize', { protocolVersion: 1 })
  const created = await h.expectResult(
    2,
    'session/new',
    {
      cwd: repo,
      mcpServers: [
        {
          type: 'stdio',
          name: 'idea',
          command: process.execPath,
          args: [fixturePath],
          env: [{ name: 'FAKE_MCP_LOG', value: logPath }]
        }
      ]
    },
    { timeoutMs: 60_000 }
  )
  const sessionId = created?.sessionId
  assert(typeof sessionId === 'string' && sessionId.length > 0, 'missing sessionId')

  // Wait for discovery so the gate can see lint_files.
  await waitForLog(m => m?.type === 'received' && m.method === 'tools/list', 'tools/list discovery', 20_000)

  const r = await h.expectResult(
    3,
    'session/prompt',
    {
      sessionId,
      prompt: [{ type: 'text', text: 'Reply with exactly the word: ok' }]
    },
    { timeoutMs: 180_000 }
  )
  assert(r?.stopReason === 'end_turn', `turn stopReason=${r?.stopReason}`)

  // The gate must have invoked lint_files over the changed file.
  await waitForLog(
    m =>
      m?.type === 'call' &&
      m.name === 'lint_files' &&
      Array.isArray(m.args?.files) &&
      m.args.files.includes('sample.ts'),
    'lint_files invocation',
    30_000
  )

  // The gate must also run the repo inspection.kts script over the changed file.
  await waitForLog(
    m =>
      m?.type === 'call' &&
      m.name === 'run_inspection_kts' &&
      m.args?.contextPath === 'sample.ts' &&
      typeof m.args?.inspectionKtsCode === 'string' &&
      m.args.inspectionKtsCode.includes('no-declared-any-ts'),
    'run_inspection_kts invocation',
    30_000
  )

  // Outcome recorded in PromptResponse._meta.
  assert(
    r?._meta?.piAcp?.inspection?.status === 'inspected',
    `inspection _meta status=${r?._meta?.piAcp?.inspection?.status}`
  )

  // Summary surfaced as an agent_message_chunk.
  assert(
    h.updateTexts().some(t => t.includes('IDE inspection:')),
    'IDE inspection summary not surfaced'
  )

  // Report persisted under the session cwd.
  const reportDir = join(repo, '.pi', 'work', 'ide-inspections', sessionId)
  assert(existsSync(reportDir), `report dir missing: ${reportDir}`)
  assert(
    readdirSync(reportDir).some(f => f.endsWith('.json')),
    'no JSON report written'
  )

  // KTS outcome recorded in the report.
  const reportJson = readdirSync(reportDir).filter(f => f.endsWith('.json'))
  const report = JSON.parse(readFileSync(join(reportDir, reportJson[0]), 'utf8'))
  assert(
    report?.kts?.some(s => s.scriptPath === 'inspections/no-any.inspection.kts' && s.status === 'ok' && s.problems >= 1),
    `kts summary missing in report: ${JSON.stringify(report?.kts)}`
  )

  await h.close()
  h.assertExited(0)
  console.log(
    `OK smoke-ide-inspect (dist ${h.distHash()}; lint_files + run_inspection_kts invoked; report persisted; summary surfaced; _meta recorded)`
  )
} catch (err) {
  await h.close().catch(() => {})
  console.error(`FAIL smoke-ide-inspect: ${err.message}`)
  if (h.stderr.length) console.error('adapter stderr tail:\n' + h.stderr.slice(-20).join(''))
  process.exit(1)
} finally {
  try {
    rmSync(work, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

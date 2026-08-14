// Bounded fresh-JetBrains acceptance runner (F-033, F-008, F-009, F-030).
// Headless checks: configured agent entry points at a dist, stale/remote adapter
// PIDs vs the dist build time, and expected config presence. Host-only checks
// (SSE, tool calls, inspections, cancel, restore, shutdown) are recorded with
// unavailable reasons; a fresh chat supplies the evidence. Writes the evidence
// and checklist into the campaign work record.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const home = homedir()
const outDir = join(root, '.pi', 'work', 'close-dogfood-findings-f008-f033')
const acpJsonPath = join(home, '.jetbrains', 'acp.json')
const distPath = join(root, 'dist', 'index.js')
const findings = []
const redact = s =>
  String(s ?? '')
    .replaceAll(root, '<repo>')
    .replaceAll(home, '<home>')
const record = (kind, message) => {
  findings.push({ kind, message: redact(message) })
  console.log(`[${kind}] ${redact(message)}`)
}

mkdirSync(outDir, { recursive: true })

// 1. Launch path: at least one agent_servers entry must reference this checkout's dist.
let configured = null
if (!existsSync(acpJsonPath)) {
  record('warn', `missing ${acpJsonPath}; configure the agent entry first (F-033)`)
} else {
  try {
    const acp = JSON.parse(readFileSync(acpJsonPath, 'utf8'))
    for (const [name, agent] of Object.entries(acp.agent_servers ?? {})) {
      const cmd = [agent?.command, ...(Array.isArray(agent?.args) ? agent.args : [])].join(' ')
      if (cmd.includes('dist/index.js')) configured = `${name}: ${cmd}`
    }
  } catch {
    record('warn', `could not parse ${acpJsonPath} (F-033)`)
  }
}
if (configured) record('ok', `agent entry references a dist: ${configured}`)
else
  record(
    'warn',
    'no agent_servers entry references dist/index.js — new chats may load a published package (F-008/F-009)'
  )

// 2. Stale/remote adapter processes vs the dist build time. etimes is elapsed
// seconds since process start, robust to locale/date formatting.
const distMtime = existsSync(distPath) ? statSync(distPath).mtime : null
const nowMs = Date.now()
const ps = spawnSync('ps', ['-eo', 'pid,etimes,args'], { encoding: 'utf8', timeout: 10_000 })
for (const line of (ps.stdout ?? '').split('\n')) {
  if (!line.includes('dist/index.js') && !line.includes('pi-acp')) continue
  const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)
  if (!m) continue
  const [, pid, etimes, args] = m
  const remote = !args.includes(root)
  const startedMs = nowMs - Number(etimes) * 1000
  if (remote) {
    record('warn', `PID ${pid} runs a different checkout: ${args.replace(root, '<repo>').slice(0, 120)} (F-009)`)
  } else if (distMtime && startedMs < distMtime.getTime()) {
    record(
      'warn',
      `PID ${pid} started ${Math.round((nowMs - startedMs) / 1000)}s ago, before the dist rebuild ${distMtime.toISOString()} — stale bundle (F-008)`
    )
  } else {
    record('ok', `PID ${pid} started ${Math.round((nowMs - startedMs) / 1000)}s ago, after the dist rebuild (F-008)`)
  }
}

// 3. Host-only acceptance items with unavailable reasons (F-030, F-033).
record(
  'todo',
  'start a fresh chat, then confirm: new PID; initialize.agentInfo._meta.piAcp.build.revision matches the on-disk bundle; SSE discovery; tool counts; an IDE tool call; inspection ids; cancel; restore; shutdown (F-033 runbook)'
)
record(
  'unavailable',
  'IDE inspection/SSE tools are not exposed to this headless executor; inspection evidence must be captured from the fresh chat (F-030)'
)

const md = [
  `# Fresh-host acceptance evidence (${new Date().toISOString()})`,
  '',
  ...findings.map(f => `- **[${f.kind}]** ${f.message}`),
  '',
  '## Fresh-chat checklist (F-033)',
  '',
  '- [ ] New PID started after the dist rebuild.',
  '- [ ] `initialize.agentInfo._meta.piAcp.build.revision` matches the on-disk bundle.',
  '- [ ] IDE Bridge section shows the expected tool count and no `unavailable` diagnostics.',
  '- [ ] An IDE tool call (e.g. search_symbol) returns a result.',
  '- [ ] Inspection ids recorded from the fresh chat.',
  '- [ ] Cancel, restore, and shutdown verified in the fresh chat.',
  ''
].join('\n')
const mdPath = join(outDir, 'fresh-host-checklist.md')
writeFileSync(mdPath, md)
console.log(`dogfood-ide: evidence written to ${mdPath.replace(root, '.')}`)

// P1-6 audit: warn findings (missing config, remote/stale adapter PIDs) mean
// acceptance is incomplete — a green exit would be false confidence. The F-033
// checklist todo is host-only and does not fail the run.
const warnCount = findings.filter(f => f.kind === 'warn').length
if (warnCount > 0) {
  console.error(`dogfood-ide: ${warnCount} warn finding(s) — fresh-host acceptance incomplete (nonzero exit)`)
  process.exit(1)
}
console.log('dogfood-ide: no warn findings; complete the fresh-chat checklist for F-033')

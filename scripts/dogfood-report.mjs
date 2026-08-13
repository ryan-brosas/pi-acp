// Dogfood report emitter (F-016, F-032): runs the probe chain from the
// smoke:full package script, captures per-probe outcome/duration, redacts
// secret-shaped content and machine paths, and writes versioned JSON + Markdown
// reports into the campaign work record.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const home = homedir()
const outDir = join(root, '.pi', 'work', 'close-dogfood-findings-f008-f033')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const full = pkg.scripts['smoke:full'] ?? ''
const probes = full
  .split('&&')
  .map(s => s.trim())
  .filter(s => s.startsWith('node scripts/smoke-'))
  .map(s => s.replace(/^node /, ''))

if (!probes.length) {
  console.error('dogfood-report: no probes found in smoke:full')
  process.exit(1)
}

const REDACT_RE =
  /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+\S+|(?:authorization|token|secret|password)[=:]\s*\S+)/gi
const redact = s =>
  String(s ?? '')
    .replace(REDACT_RE, '[redacted]')
    .replaceAll(root, '<repo>')
    .replaceAll(home, '<home>')

const started = new Date().toISOString()
const results = []
let failures = 0
for (const probe of probes) {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [probe], { cwd: root, encoding: 'utf8', timeout: 240_000 })
  const ok = r.status === 0
  if (!ok) failures++
  const summaryLine = (r.stdout ?? '').split('\n').find(l => /^OK |^FAIL /.test(l)) ?? ''
  results.push({
    probe,
    ok,
    exitCode: r.status,
    signal: r.signal ?? null,
    durationMs: Date.now() - t0,
    summary: redact(summaryLine),
    stderrTail: redact((r.stderr ?? '').split('\n').slice(-5).join('\n'))
  })
}

let distSha256 = null
let buildRevision = null
if (existsSync(join(root, 'dist', 'index.js'))) {
  distSha256 = createHash('sha256')
    .update(readFileSync(join(root, 'dist', 'index.js')))
    .digest('hex')
}
const firstOk = results.find(r => r.ok && /build [0-9a-f]{6,}/.test(r.summary))
if (firstOk) buildRevision = /build ([0-9a-f]{6,})/.exec(firstOk.summary)?.[1] ?? null

const report = {
  schema: 'pi-acp.dogfood-report.v1',
  generatedAt: started,
  repository: pkg.name,
  node: process.version,
  build: { distSha256, buildRevision },
  probes: results,
  okCount: results.filter(r => r.ok).length,
  totalCount: results.length,
  exitOk: failures === 0
}

mkdirSync(outDir, { recursive: true })
const stamp = started.replace(/[:.]/g, '-')
const jsonPath = join(outDir, `dogfood-report-${stamp}.json`)
const mdPath = join(outDir, `dogfood-report-${stamp}.md`)
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n')
const md = [
  `# Dogfood report (${started})`,
  '',
  `- Repository: ${pkg.name}`,
  `- Node: ${process.version}`,
  `- Dist sha256: ${distSha256 ?? 'unknown'}`,
  `- Build revision: ${buildRevision ?? 'unknown'}`,
  `- Result: ${report.okCount}/${report.totalCount} probes OK`,
  '',
  '| Probe | Status | Duration | Summary |',
  '| --- | --- | --- | --- |'
]
for (const r of results) {
  md.push(`| ${r.probe} | ${r.ok ? 'OK' : 'FAIL'} | ${r.durationMs}ms | ${r.summary.replaceAll('|', '\\|') || '-'} |`)
}
md.push('', 'Redacted: credential-shaped strings and machine paths are replaced before writing.')
writeFileSync(mdPath, md.join('\n') + '\n')

console.log(
  `dogfood-report: ${report.okCount}/${report.totalCount} probes OK (${failures ? 'FAILURES PRESENT' : 'exit 0'})`
)
console.log(`dogfood-report: json ${jsonPath.replace(root, '.')}`)
console.log(`dogfood-report: md   ${mdPath.replace(root, '.')}`)
process.exit(failures ? 1 : 0)

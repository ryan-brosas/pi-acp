// Usage: node scripts/validate-release-hygiene.mjs [root]
// Fails (exit 1) on: tracked runtime state, machine-specific absolute paths,
// credential-shaped strings in tracked files, and drift between documented
// counts (prompts, skills, templates) and the actual tree.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.argv[2] ? resolve(process.argv[2]) : process.cwd()
const errors = []
const fail = msg => errors.push(msg)

const tracked = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
if (tracked.status !== 0) {
  console.error('[fail] git ls-files failed; run inside the repository')
  process.exit(1)
}
const files = tracked.stdout.split('\n').filter(Boolean)

// 1. Machine-specific absolute paths must not ship in a reusable template.
// /home/runner is a documented GitHub Actions CI path in CLI references, not a user path.
const HOME_RE = /\/(home|Users)\/(?!runner(?:\/|$))[^/\s]+(?:\/|$)/
for (const f of files) {
  const full = join(root, f)
  if (!existsSync(full)) continue // tracked-but-deleted working-tree files (unstaged cleanup)
  const text = readFileSync(full, 'utf8')
  const m = text.match(HOME_RE)
  if (m) fail(`machine-specific absolute path ${m[0].trim()} in ${f}`)
}

// 2. Credential-shaped strings must not ship.
const SECRET_RE =
  /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----)/
for (const f of files) {
  if (!existsSync(join(root, f))) continue
  const text = readFileSync(join(root, f), 'utf8')
  if (SECRET_RE.test(text)) fail(`credential-shaped string in ${f}`)
}

// 3. Runtime/generated local state must stay untracked.
const RUNTIME_RE = /^(?:\.pi\/(?:MEMORY\.md|implementation-notes\.md|fabric\/)|\.veda(?:\/|$))/
const runtime = files.filter(f => RUNTIME_RE.test(f))
if (runtime.length) fail(`tracked runtime state: ${runtime.join(', ')}`)

// 4. Documented counts must match the tree (README is the release surface).
if (!existsSync(join(root, '.pi'))) {
  console.log('[skip] README count checks; .pi is not in this checkout')
  process.exit(0)
}
const prompts = readdirSync(join(root, '.pi', 'prompts')).filter(n => n.endsWith('.md')).length
const templates = readdirSync(join(root, '.pi', 'templates')).filter(n => n.endsWith('.md')).length
const catalog = JSON.parse(readFileSync(join(root, '.pi', 'skills', 'packs.json'), 'utf8'))
const leaves = catalog.packs.reduce((n, p) => n + (p.members || []).length, 0) + (catalog.visibleCore || []).length
const skillFiles = leaves + catalog.packs.length
const readme = readFileSync(join(root, 'README.md'), 'utf8')
const check = (re, expected, label) => {
  const m = readme.match(re)
  if (!m || Number(m[1]) !== expected) {
    fail(`README ${label} mismatch (README: ${m ? m[1] : 'absent'}; tree: ${expected}); fix README or the tree`)
  }
}
check(/(\d+) prompt commands/, prompts, 'prompt commands')
check(/(\d+) skill files/, skillFiles, 'skill files')
check(/(\d+) format templates/, templates, 'format templates')
const lp = readme.match(/(\d+) leaves in (\d+) packs/)
if (!lp || Number(lp[1]) !== leaves || Number(lp[2]) !== catalog.packs.length) {
  fail(
    `README "leaves in packs" mismatch (README: ${lp ? lp[1] + ' in ' + lp[2] : 'absent'}; tree: ${leaves} leaves in ${catalog.packs.length} packs)`
  )
}

if (errors.length) {
  console.error('[fail] release-hygiene violations:')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
console.log(
  `[ok] tracked=${files.length} prompts=${prompts} skills=${skillFiles} (leaves=${leaves}, packs=${catalog.packs.length}) templates=${templates} secrets=0 machinePaths=0 runtimeState=0`
)

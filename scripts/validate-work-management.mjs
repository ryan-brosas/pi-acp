// Work-management contract gate: pins .pi/work ownership, local state,
// local slug work IDs, GitHub issue/PR templates, prompt path consistency,
// and /init GitHub setup safety (detection, approval, verification, optionality).
// Usage: node scripts/validate-work-management.mjs [root]
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('..', import.meta.url))
if (!existsSync(join(root, '.pi'))) {
  console.log('[skip] .pi is not in this checkout; work-management checks run in the development tree')
  process.exit(0)
}
let failures = 0
const ok = m => console.log('[ok] ' + m)
const fail = m => {
  failures++
  console.log('[fail] ' + m)
}

// 1. Tracked work contract
const artifactsRef = text => /\.pi\/artifacts/.test(text)
const prompts = [
  '.pi/prompts/create.md',
  '.pi/prompts/plan.md',
  '.pi/prompts/research.md',
  '.pi/prompts/ship.md',
  '.pi/prompts/verify.md',
  '.pi/prompts/init.md',
  '.pi/prompts/gc.md'
]
let artifactsRefs = 0
for (const rel of prompts) {
  const path = join(root, rel)
  if (!existsSync(path)) {
    fail('missing ' + rel)
    continue
  }
  if (artifactsRef(readFileSync(path, 'utf8'))) {
    artifactsRefs++
    fail(rel + ' still references .pi/artifacts')
  }
}
if (artifactsRefs === 0) ok('no workflow prompt references .pi/artifacts')
else fail('workflow prompts must drop .pi/artifacts (remove the directory, colocate state under .pi/work)')
const workDir = join(root, '.pi', 'work')
const activePathNew = join(workDir, '.active')
if (existsSync(activePathNew)) ok('.pi/work/.active resolves')
else ok('.pi/work/.active is the active-pointer contract (created by /create)')
if (existsSync(join(workDir, 'README.md'))) {
  const wr = readFileSync(join(workDir, 'README.md'), 'utf8')
  if (artifactsRef(wr)) fail('.pi/work/README.md still references .pi/artifacts')
  else ok('.pi/work/README.md is artifact-free')
}
if (existsSync(join(root, '.pi', 'MEMORY.md'))) ok('.pi/MEMORY.md exists')
else ok('.pi/MEMORY.md is the local memory contract')

if (!existsSync(join(root, '.pi', 'prompts', 'create.md'))) fail('missing .pi/prompts/create.md')
else {
  const createText = readFileSync(join(root, '.pi', 'prompts', 'create.md'), 'utf8')
  if (/gh issue create/.test(createText))
    fail('create.md still creates GitHub issues; /create must stay local by default')
  else ok('create.md never creates a GitHub issue')
  if (/Resolve the GitHub issue before creating any local record/.test(createText))
    fail('create.md still blocks local records on a GitHub issue')
  else ok('create.md creates local records without GitHub')
  if (/--issue <number>/.test(createText)) ok('create.md offers optional --issue linkage')
  else fail('create.md missing optional --issue linkage')
  if (/gh issue view/.test(createText)) ok('create.md verifies linked issues with gh issue view')
  else fail('create.md missing gh issue view verification for --issue')
  if (/slug/i.test(createText)) ok('create.md uses a slug for local work identity')
  else fail('create.md missing slug-based local identity')
}
if (existsSync(join(root, '.pi', 'work', 'README.md'))) ok('.pi/work/README.md exists')
else fail('missing .pi/work/README.md')
if (existsSync(join(root, '.pi', 'templates', 'issue.md'))) ok('.pi/templates/issue.md exists')
else fail('missing .pi/templates/issue.md')

// 2. No Bead metadata in templates or workflow prompts. Scans every .md file
// under .pi/templates and .pi/prompts, case-insensitively, so bead-era drift
// cannot sneak in through unlisted files or "Bead ID:" variants.
const beadFiles = [
  ...readdirSync(join(root, '.pi', 'templates'))
    .filter(f => f.endsWith('.md'))
    .map(f => '.pi/templates/' + f),
  ...readdirSync(join(root, '.pi', 'prompts'))
    .filter(f => f.endsWith('.md'))
    .map(f => '.pi/prompts/' + f)
]
for (const rel of beadFiles) {
  const path = join(root, rel)
  if (!existsSync(path)) {
    fail('missing ' + rel)
    continue
  }
  if (/bead/i.test(readFileSync(path, 'utf8'))) fail(rel + ' still carries Bead metadata')
  else ok(rel + ' has no Bead metadata')
}

// 3. Prompt path ownership: durable records tracked, local state ignored
const promptChecks = {
  'init.md': [
    'git remote get-url origin', // detects the remote before proposing any mutation
    'gh repo view', // verifies existing and created repositories
    'gh repo create', // creation path exists
    'explicit approval', // never creates without approval
    'separate approval', // push and Project are distinct approvals
    'gh project', // central Project enrollment is offered
    'gh auth status' // local init works without gh; graceful skip
  ],
  'create.md': ['.pi/work/$ID', 'gh issue', 'no-durable-under-artifacts'],
  'plan.md': ['.pi/work/$(cat .pi/work/.active)', 'no-durable-under-artifacts'],
  'ship.md': ['.pi/work/$(cat .pi/work/.active)', 'progress.md', 'no-durable-under-artifacts'],
  'verify.md': ['.pi/work/$(cat .pi/work/.active)', 'verification.md', 'verify.log', 'no-durable-under-artifacts']
}
for (const [name, checks] of Object.entries(promptChecks)) {
  const path = join(root, '.pi', 'prompts', name)
  if (!existsSync(path)) {
    fail('missing .pi/prompts/' + name)
    continue
  }
  const text = readFileSync(path, 'utf8')
  // Normalize the active-pointer indirection so durable writes like
  // .pi/work/$(cat .pi/work/.active)/plan.md are detectable while
  // read guards (.pi/work/.../spec.md) stay clean.
  const normalized = text.replaceAll('$(cat .pi/work/.active)', 'ACTIVE')
  for (const check of checks) {
    if (check === 'no-durable-under-artifacts') {
      if (/\.pi\/artifacts\/[^\s`]*\/(spec|plan|tasks|research|design|verification)\.md/.test(normalized))
        fail(name + ' writes a durable record under artifacts')
      else ok(name + ' writes no durable record under artifacts')
    } else if (text.includes(check)) ok(name + ' uses ' + check)
    else fail(name + ' missing ' + check)
  }
}

// 4. GitHub issue forms and PR template
for (const rel of [
  '.github/ISSUE_TEMPLATE/feature.yml',
  '.github/ISSUE_TEMPLATE/bug.yml',
  '.github/ISSUE_TEMPLATE/research.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/pull_request_template.md'
]) {
  if (existsSync(join(root, rel))) ok(rel + ' exists')
  else fail('missing ' + rel)
}

// 5. Active pointer resolution (optional; only when work is in flight)
const activePath = join(root, '.pi', 'work', '.active')
if (existsSync(activePath)) {
  const id = readFileSync(activePath, 'utf8').trim()
  if (/^[a-z0-9][a-z0-9-]*$/.test(id) || /^[0-9]+-[a-z0-9-]+$/.test(id)) {
    if (existsSync(join(root, '.pi', 'work', id))) ok('active pointer resolves: ' + id)
    else fail('active pointer has no .pi/work dir: ' + id)
  } else fail('active pointer is not <slug> or <issue>-<slug>: ' + id)
} else ok('no active pointer (no in-flight work)')

console.log(failures ? 'work-management contract: FAIL' : 'work-management contract: ok')
process.exit(failures ? 1 : 0)

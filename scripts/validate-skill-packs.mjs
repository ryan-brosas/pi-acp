// Usage: node scripts/validate-skill-packs.mjs [root]
// Fails (exit 1) on: unassigned leaves, duplicate primary membership, missing members,
// wrong visibility, visible-metadata budget overflow, unsafe or missing descriptions,
// Agent Skills name violations, unknown frontmatter fields, stale harness vocabulary,
// non-trigger or over-budget hidden-leaf descriptions, catalog-router parity breaks,
// router word-budget overflow, and manifest drift.
// Warns on leaves exceeding the leaf word threshold. Pass [root] to validate another tree.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('..', import.meta.url))
const skillsRoot = join(root, '.pi', 'skills')
const catalogPath = join(skillsRoot, 'packs.json')
const manifestPath = join(skillsRoot, 'manifest.json')

if (!existsSync(skillsRoot)) {
  console.log('[skip] .pi/skills is not in this checkout; skill-pack checks run in the development tree')
  process.exit(0)
}

const STALE_TOOL_RE = /TaskCreate|TaskUpdate|ask_user_question|web_fetch|grepsearch|superpi/
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ALLOWED_FIELDS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
  'disable-model-invocation'
])
const TRIGGER_RE = /^Use when /
const TRIGGER_BUDGET = 240
const ROUTER_WORD_BUDGET = 190
const LEAF_WARN_WORDS = 600
const wordCount = s => s.trim().split(/\s+/).length
const unquote = s =>
  (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")) ? s.slice(1, -1) : s
const listedNames = text => {
  const names = new Set()
  for (const m of text.matchAll(/^\s*[-|]\s*([a-z0-9][a-z0-9-]*)\s*(?::|\|)/gm)) names.add(m[1])
  return names
}

function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(full))
    else if (entry.isFile() && entry.name === 'SKILL.md') found.push(full)
  }
  return found
}

function parse(file) {
  const text = readFileSync(file, 'utf8')
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  const fields = {}
  const keys = []
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':')
      if (i <= 0) continue
      const key = line.slice(0, i).trim()
      keys.push(key)
      fields[key] = line.slice(i + 1).trim()
    }
  }
  const description = fields.description || ''
  const quoted =
    (description.startsWith('"') && description.endsWith('"')) ||
    (description.startsWith("'") && description.endsWith("'"))
  return {
    file,
    text,
    keys,
    rel: file.slice(skillsRoot.length + 1),
    name: fields.name || basename(dirname(file)),
    description,
    descriptionUnsafe: description.includes(': ') && !quoted,
    disabled: String(fields['disable-model-invocation']).toLowerCase() === 'true'
  }
}

let catalog
try {
  catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
} catch (e) {
  console.error(`[fail] cannot read catalog ${catalogPath}: ${e.message}`)
  process.exit(1)
}
let manifest = null
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch {
  manifest = null
}

const errors = []
const fail = msg => errors.push(msg)
const hygiene = []
const failHygiene = msg => {
  hygiene.push(msg)
  fail(msg)
}
const parity = []
const failParity = msg => {
  parity.push(msg)
  fail(msg)
}
const metadataFailures = []
const failMetadata = msg => {
  metadataFailures.push(msg)
  fail(msg)
}
const triggerFailures = []
const failTrigger = msg => {
  triggerFailures.push(msg)
  fail(msg)
}
const manifestFailures = []
const failManifest = msg => {
  manifestFailures.push(msg)
  fail(msg)
}
const MAX_AUTO = catalog.maxAutoLoadedLeafSkills
const BUDGET = catalog.maxVisibleMetadataTokens
const core = Array.isArray(catalog.visibleCore) ? catalog.visibleCore : []
const packs = Array.isArray(catalog.packs) ? catalog.packs : []
if (typeof catalog.version !== 'number') fail('catalog.version must be a number')
if (!Number.isInteger(MAX_AUTO) || MAX_AUTO < 1) fail('catalog.maxAutoLoadedLeafSkills must be an integer >= 1')
if (!Number.isInteger(BUDGET) || BUDGET < 1) fail('catalog.maxVisibleMetadataTokens must be an integer >= 1')
if (!packs.length) fail('catalog.packs must contain at least one pack')
for (const pack of packs) {
  if (!pack.id || !String(pack.id).startsWith('pack-')) fail(`pack missing id: ${JSON.stringify(pack).slice(0, 80)}`)
  if (!Array.isArray(pack.members)) fail(`pack ${pack.id} missing members array`)
}

const discovered = walk(skillsRoot).map(parse)
const routers = discovered.filter(
  s => dirname(dirname(s.file)) === skillsRoot && basename(dirname(s.file)).startsWith('pack-')
)
const leaves = discovered.filter(s => !routers.includes(s))
const byName = new Map(discovered.map(s => [s.name, s]))

// Hygiene: retrieval metadata Pi actually consumes.
for (const s of discovered) {
  if (!s.description) failHygiene(`skill ${s.rel} is missing a description; Pi does not load skills without one`)
  if (s.description.length > 1024)
    failHygiene(`skill ${s.rel} description is ${s.description.length} chars; the Agent Skills limit is 1024`)
  if (s.descriptionUnsafe)
    failHygiene(
      `unsafe description frontmatter in ${s.rel}: an unquoted ": " reads as a YAML mapping; wrap the description in double quotes`
    )
  if (!NAME_RE.test(s.name) || s.name.length > 64)
    failHygiene(
      `skill ${s.rel} name "${s.name}" violates Agent Skills name rules (lowercase letters, digits, hyphens, 1-64 chars, no leading/trailing/consecutive hyphens)`
    )
  for (const k of s.keys) {
    if (!ALLOWED_FIELDS.has(k))
      failMetadata(`unknown frontmatter field "${k}" in ${s.rel}; allowed: ${[...ALLOWED_FIELDS].join(', ')}`)
  }
  if (STALE_TOOL_RE.test(s.text)) failHygiene(`stale harness vocabulary in ${s.rel}: ${STALE_TOOL_RE.exec(s.text)[0]}`)
}

// Trigger-first hidden-leaf descriptions within budget.
for (const leaf of leaves) {
  if (core.includes(leaf.name)) continue
  const d = unquote(leaf.description)
  if (!TRIGGER_RE.test(d)) failTrigger(`description must be trigger-first ("Use when ...") in ${leaf.rel}`)
  if (d.length > TRIGGER_BUDGET)
    failTrigger(`description is ${d.length} chars in ${leaf.rel}; trigger budget is ${TRIGGER_BUDGET}`)
}

// Catalog-router parity: ids, descriptions, and member lists must agree.
for (const pack of packs) {
  if (!routers.some(r => r.name === pack.id))
    failParity(`catalog pack "${pack.id}" has no router SKILL.md with name=${pack.id}`)
}
for (const r of routers) {
  const pack = packs.find(p => p.id === r.name)
  if (!pack) {
    failParity(`router "${r.name}" is not a catalog pack id`)
    continue
  }
  if (unquote(r.description) !== pack.description)
    failParity(`router "${r.name}" description must match the catalog pack description`)
  const listed = listedNames(r.text)
  const missing = (pack.members || []).filter(m => !listed.has(m))
  const extra = [...listed].filter(m => !(pack.members || []).includes(m))
  if (missing.length) failParity(`router "${r.name}" omits catalog members: ${missing.join(', ')}`)
  if (extra.length) failParity(`router "${r.name}" lists non-catalog members: ${extra.join(', ')}`)
  if (wordCount(r.text) >= ROUTER_WORD_BUDGET)
    failParity(`router "${r.name}" is ${wordCount(r.text)} words; budget is ${ROUTER_WORD_BUDGET} (compact it)`)
}

// Membership: every leaf in exactly one pack (or visibleCore).
for (const pack of packs) {
  for (const member of pack.members || []) {
    if (!byName.has(member)) fail(`missing member "${member}" declared by ${pack.id} (no such SKILL.md on disk)`)
  }
}
const memberOf = new Map()
for (const pack of packs) {
  for (const member of pack.members || []) {
    memberOf.set(member, [...(memberOf.get(member) || []), pack.id])
  }
}
for (const [name, packsOf] of memberOf) {
  if (packsOf.length > 1) fail(`duplicate primary membership: "${name}" in ${packsOf.join(', ')} (exactly one pack)`)
}
for (const leaf of leaves) {
  const inPack = memberOf.get(leaf.name) || []
  const inCore = core.includes(leaf.name)
  if (inPack.length === 0 && !inCore)
    fail(`unassigned leaf "${leaf.name}" at ${leaf.rel}: add it to exactly one pack in packs.json or to visibleCore`)
  if (inCore && inPack.length > 0) fail(`"${leaf.name}" is in visibleCore AND in a pack; choose one`)
}
for (const name of core) {
  if (!byName.has(name)) fail(`visibleCore entry "${name}" has no SKILL.md on disk`)
}

// Visibility: routers and core visible, leaves hidden.
for (const r of routers) {
  if (r.disabled) fail(`pack router "${r.name}" must be model-visible (remove disable-model-invocation)`)
}
for (const name of core) {
  const s = byName.get(name)
  if (s && s.disabled) fail(`core skill "${name}" must be model-visible (remove disable-model-invocation)`)
}
for (const leaf of leaves) {
  if (!core.includes(leaf.name) && !leaf.disabled)
    fail(`leaf "${leaf.name}" at ${leaf.rel} is model-visible; add "disable-model-invocation: true" to its frontmatter`)
}

// Context budget: visible metadata stays under the catalog limit.
const visible = [...routers, ...core.map(n => byName.get(n)).filter(Boolean)]
const metaChars = visible.reduce((n, s) => n + s.name.length + s.description.length, 0)
const metaTokens = Math.ceil(metaChars / 4)
if (metaTokens > BUDGET)
  fail(`visible metadata ${metaTokens} tokens exceeds budget ${BUDGET} (compact pack descriptions or hide more leaves)`)

// Manifest parity: retained ledger must match packs.json and disk state.
{
  const expectedRetained = discovered
    .filter(s => !routers.includes(s))
    .map(s => ({
      name: s.name,
      pack: core.includes(s.name) ? 'core' : memberOf.get(s.name)?.[0],
      modelVisible: core.includes(s.name)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const actualRetained =
    manifest && Array.isArray(manifest.retained)
      ? manifest.retained
          .map(r => ({ name: r.name, pack: r.pack, modelVisible: !!r.modelVisible }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : []
  if (!manifest || !manifest.generated || JSON.stringify(expectedRetained) !== JSON.stringify(actualRetained)) {
    failManifest(
      'manifest drift: .pi/skills/manifest.json retained entries do not match packs.json and disk state; run node scripts/sync-skill-manifest.mjs'
    )
  }
}

// Size accounting: report router budget and warn on oversized leaves.
const routerWords = routers.length ? Math.max(...routers.map(r => wordCount(r.text))) : 0
const leafWords = leaves.length ? Math.max(...leaves.map(s => wordCount(s.text))) : 0
for (const s of leaves) {
  const n = wordCount(s.text)
  if (n > LEAF_WARN_WORDS)
    console.warn(`[warn] leaf ${s.rel} is ${n} words (threshold ${LEAF_WARN_WORDS}); move detail to references/`)
}

if (errors.length) {
  console.error(`[fail] ${errors.length} skill-pack violation(s):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log(
  `[ok] packs=${packs.length} members=${[...memberOf.keys()].length} core=${core.length} leaves=${leaves.length} routers=${routers.length} visible=${visible.length} metadata=${metaChars} chars (~${metaTokens} tokens) maxAuto=${MAX_AUTO} budget=${BUDGET} hygiene=${hygiene.length ? 'fail' : 'ok'} parity=${parity.length ? 'fail' : 'ok'} triggers=${triggerFailures.length ? 'fail' : 'ok'} metadata=${metadataFailures.length ? 'fail' : 'ok'} manifest=${manifestFailures.length ? 'fail' : 'ok'} routerWords=${routerWords}/${ROUTER_WORD_BUDGET} leafWords=${leafWords}/${LEAF_WARN_WORDS}`
)

// Validates the smoke matrix inventory (F-026): every scripts/smoke-*.mjs probe
// must be reachable from a package.json script and must own its deadlines via the
// shared harness (which also provides isolation, redaction, and shutdown).
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('..', import.meta.url))
let failures = 0
const ok = m => console.log('[ok] ' + m)
const fail = m => {
  failures++
  console.log('[fail] ' + m)
}

const probes = readdirSync(join(root, 'scripts'))
  .filter(n => /^smoke-[a-z0-9-]+\.mjs$/.test(n))
  .sort()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const scripts = Object.values(pkg.scripts ?? {}).join('\n')

for (const f of probes) {
  const rel = 'scripts/' + f
  if (!scripts.includes(rel)) {
    fail(`${rel} is not referenced by any package.json script (reachability)`)
  } else {
    ok(`${rel} reachable via package scripts`)
  }
  const text = readFileSync(join(root, rel), 'utf8')
  if (!text.includes("from './lib/acp-smoke.mjs'") || !/new SmokeHarness\s*\(/.test(text)) {
    fail(`${rel} does not import and construct the shared harness (deadline/isolation ownership)`)
  }
}

if (probes.length < 5) fail(`expected at least 5 smoke probes, found ${probes.length}`)
if (probes.length === 0) fail('no smoke probes found')

if (failures) {
  console.log('smoke-inventory contract: FAIL')
  process.exit(1)
}
console.log(`[ok] smoke inventory: ${probes.length} probes registered and harness-owned`)
console.log('smoke-inventory contract: ok')

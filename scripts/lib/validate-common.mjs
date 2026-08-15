// Shared helpers for the dev-tree validator scripts and skill manifest sync.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Collect every SKILL.md path under dir, depth-first, in readdir order. */
export function findSkillFiles(dir) {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...findSkillFiles(full))
    else if (entry.isFile() && entry.name === 'SKILL.md') found.push(full)
  }
  return found
}

/** [ok]/[fail] reporter that counts failures for the final exit code. */
export function createReporter() {
  let failures = 0
  return {
    ok: m => console.log('[ok] ' + m),
    fail: m => {
      failures++
      console.log('[fail] ' + m)
    },
    get failCount() {
      return failures
    }
  }
}

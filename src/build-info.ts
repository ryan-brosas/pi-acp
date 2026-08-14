// Build identity for the running adapter bundle.
// Release builds inject __PI_ACP_BUILD_REVISION__ / __PI_ACP_BUILD_TIME__ via
// tsup `define`; dev (tsx) and test runtimes fall back to git and the nearest
// package.json so the shape is always populated.

declare const __PI_ACP_BUILD_REVISION__: string | undefined
declare const __PI_ACP_BUILD_TIME__: string | undefined
declare const __PI_ACP_BUILD_DIRTY__: string | undefined

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface BuildInfo {
  /** Short git revision of the source this bundle was built from. */
  revision: string
  /** ISO build timestamp; empty in dev runs. */
  buildTime: string
  packageVersion: string
  /** True when built through tsup (constants injected), false in dev/tests. */
  isRelease: boolean
  /** True when the git tree had uncommitted changes at build time (P2-15 audit). */
  dirty: boolean
}

function gitShortRevision(): string {
  try {
    const r = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8', timeout: 3000 })
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim()
  } catch {
    // no git available
  }
  return 'dev'
}

function nearestPackageJsonVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 6; i++) {
    const p = join(dir, 'package.json')
    if (existsSync(p)) {
      try {
        const parsed = JSON.parse(readFileSync(p, 'utf8')) as { version?: string }
        if (typeof parsed.version === 'string') return parsed.version
      } catch {
        // ignore unreadable package.json
      }
    }
    dir = dirname(dir)
  }
  return '0.0.0'
}

export const buildInfo: BuildInfo = {
  revision:
    typeof __PI_ACP_BUILD_REVISION__ === 'string' && __PI_ACP_BUILD_REVISION__
      ? __PI_ACP_BUILD_REVISION__
      : gitShortRevision(),
  buildTime: typeof __PI_ACP_BUILD_TIME__ === 'string' ? __PI_ACP_BUILD_TIME__ : '',
  packageVersion: nearestPackageJsonVersion(),
  isRelease: typeof __PI_ACP_BUILD_REVISION__ === 'string',
  dirty: typeof __PI_ACP_BUILD_DIRTY__ === 'string' ? __PI_ACP_BUILD_DIRTY__ === 'true' : false
}

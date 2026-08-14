import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  mergeInspectFiles,
  runKtsInspections,
  summarizeMalformedRaw,
  type InspectionBridge
} from '../../src/acp/ide-inspection.js'

describe('mergeInspectFiles', () => {
  function fixture(): string {
    const dir = mkdtempSync(join(tmpdir(), 'gate-hardening-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1\n')
    writeFileSync(join(dir, 'src', 'b.ts'), 'export const b = 2\n')
    return dir
  }

  it('dedupes git + extra files, preferring extra order', () => {
    const dir = fixture()
    try {
      const files = mergeInspectFiles(dir, ['src/a.ts'], ['src/a.ts', 'src/b.ts'])
      assert.deepEqual(files, ['src/a.ts', 'src/b.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('filters excluded prefixes and nonexistent paths', () => {
    const dir = fixture()
    try {
      const files = mergeInspectFiles(
        dir,
        ['dist/x.js', 'node_modules/y/index.ts', 'src/missing.ts', 'src/a.ts'],
        ['src/a.ts']
      )
      assert.deepEqual(files, ['src/a.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('respects maxFiles', () => {
    const dir = fixture()
    try {
      const files = mergeInspectFiles(dir, ['src/a.ts', 'src/b.ts'], [], 1)
      assert.deepEqual(files, ['src/a.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('normalizes ./ and absolute paths inside the repo', () => {
    const dir = fixture()
    try {
      const files = mergeInspectFiles(dir, ['./src/a.ts'], [join(dir, 'src', 'b.ts'), 'src/a.ts'])
      assert.deepEqual(files, ['src/b.ts', 'src/a.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects traversal and outside-repo absolute paths', () => {
    const dir = fixture()
    try {
      const files = mergeInspectFiles(dir, ['../outside.ts', '/etc/passwd', 'src/../../x.ts'], ['src/a.ts'])
      assert.deepEqual(files, ['src/a.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('excludes prefixed paths even when ./-prefixed', () => {
    const dir = fixture()
    try {
      mkdirSync(join(dir, 'node_modules'), { recursive: true })
      writeFileSync(join(dir, 'node_modules', 'y.ts'), 'x')
      const files = mergeInspectFiles(dir, ['./node_modules/y.ts'], ['src/a.ts'])
      assert.deepEqual(files, ['src/a.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prefers turn-touched extra files at the maxFiles cap', () => {
    const dir = fixture()
    try {
      const files = mergeInspectFiles(dir, ['src/a.ts', 'src/b.ts'], ['src/b.ts'], 1)
      assert.deepEqual(files, ['src/b.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('summarizeMalformedRaw', () => {
  it('truncates oversized payloads', () => {
    const raw = { compilationSuccess: null, note: 'x'.repeat(2000) }
    const s = summarizeMalformedRaw(raw)
    assert.ok(s.length <= 400)
    assert.ok(s.includes('compilationSuccess'))
  })

  it('falls back to String() for non-serializable values', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    assert.equal(summarizeMalformedRaw(circular), '[object Object]')
  })

  it('renders primitives', () => {
    assert.equal(summarizeMalformedRaw('tool error: kaboom'), '"tool error: kaboom"')
    assert.equal(summarizeMalformedRaw(null), 'null')
  })
})

describe('runKtsInspections retry budget', () => {
  function fixture(): string {
    const dir = mkdtempSync(join(tmpdir(), 'kts-retry-'))
    mkdirSync(join(dir, 'inspections'), { recursive: true })
    writeFileSync(join(dir, 'inspections', 'no-any.inspection.kts'), '// rule\n')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1\n')
    return dir
  }

  it('skips the retry and reports when the call budget is exhausted', async () => {
    const dir = fixture()
    try {
      let counted = 0
      const bridge = {
        hasRemoteTool: (name: string) => name === 'run_inspection_kts',
        callRemoteTool: async () => {
          counted += 1
          return { compilationSuccess: null }
        }
      } as InspectionBridge
      const result = await runKtsInspections({ bridge, cwd: dir, files: ['src/a.ts'], timeoutMs: 1000, maxCalls: 1 })
      assert.equal(counted, 1)
      assert.equal(result?.summaries[0]?.status, 'malformed')
      assert.match(result?.summaries[0]?.message ?? '', /no retry budget/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('retries once within the budget', async () => {
    const dir = fixture()
    try {
      let n = 0
      const bridge = {
        hasRemoteTool: (name: string) => name === 'run_inspection_kts',
        callRemoteTool: async () => {
          n += 1
          return n === 1
            ? { compilationSuccess: null }
            : { compilationSuccess: true, inspectionResultMessage: 'ok', foundProblems: [] }
        }
      } as InspectionBridge
      const result = await runKtsInspections({ bridge, cwd: dir, files: ['src/a.ts'], timeoutMs: 1000, maxCalls: 2 })
      assert.equal(n, 2)
      assert.equal(result?.summaries[0]?.status, 'ok')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

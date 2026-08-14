import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mergeInspectFiles, summarizeMalformedRaw } from '../../src/acp/ide-inspection.js'

describe('mergeInspectFiles', () => {
  function fixture(): string {
    const dir = mkdtempSync(join(tmpdir(), 'gate-hardening-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1\n')
    writeFileSync(join(dir, 'src', 'b.ts'), 'export const b = 2\n')
    return dir
  }

  it('dedupes git + extra files, preserving git order', () => {
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
      const files = mergeInspectFiles(dir, ['dist/x.js', 'node_modules/y/index.ts', 'src/missing.ts', 'src/a.ts'], ['src/a.ts'])
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
})

describe('summarizeMalformedRaw', () => {
  it('truncates oversized payloads', () => {
    const raw = { compilationSuccess: undefined, note: 'x'.repeat(2000) }
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
    assert.equal(summarizeMalformedRaw('tool error: kaboom'), 'tool error: kaboom')
    assert.equal(summarizeMalformedRaw(null), 'null')
  })
})

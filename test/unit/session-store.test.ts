import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from '../../src/acp/session-store.js'

test('SessionStore round-trips with atomic writes and leaves no temp files (P2-7 audit)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-acp-store-'))
  const path = join(dir, 'session-map.json')
  const store = new SessionStore(path)

  store.upsert({ sessionId: 'a', cwd: '/tmp', sessionFile: '/tmp/a.json' })
  store.upsert({ sessionId: 'b', cwd: '/tmp', sessionFile: '/tmp/b.json' })
  assert.equal(store.get('a')?.sessionId, 'a')
  assert.equal(store.get('b')?.sessionId, 'b')

  store.delete('a')
  assert.equal(store.get('a'), null)
  assert.equal(store.get('b')?.sessionId, 'b')

  const leftovers = readdirSync(dir).filter(f => f.includes('.tmp-'))
  assert.deepEqual(leftovers, [])
})

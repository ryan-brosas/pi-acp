import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
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

function runStoreWorker(path: string, worker: number, entries: number): Promise<void> {
  const source = `
    import { SessionStore } from './src/acp/session-store.ts'
    const store = new SessionStore(${JSON.stringify(path)})
    for (let i = 0; i < ${entries}; i++) {
      const sessionId = 'worker-${worker}-' + i
      store.upsert({ sessionId, cwd: '/tmp', sessionFile: '/tmp/' + sessionId + '.json' })
    }
  `
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', source], {
      cwd: process.cwd(),
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => (stderr += String(chunk)))
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`session-store worker ${worker} exited ${code}: ${stderr}`))
    })
  })
}

test('SessionStore preserves updates from concurrent adapter processes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-acp-store-concurrent-'))
  const path = join(dir, 'session-map.json')
  const workers = 8
  const entriesPerWorker = 40

  await Promise.all(Array.from({ length: workers }, (_, worker) => runStoreWorker(path, worker, entriesPerWorker)))

  const data = JSON.parse(readFileSync(path, 'utf8')) as { sessions: Record<string, unknown> }
  assert.equal(Object.keys(data.sessions).length, workers * entriesPerWorker)
  assert.deepEqual(
    readdirSync(dir).filter(file => file.includes('.tmp-') || file.endsWith('.lock')),
    []
  )
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { PassThrough } from 'node:stream'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PiRpcProcess } from '../../src/pi-rpc/process.js'

test('PiRpcProcess: silent RPC requests reject at the configured deadline', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-acp-silent-rpc-'))
  const executable = join(dir, 'silent-pi')
  writeFileSync(executable, '#!/usr/bin/env node\nprocess.stdin.resume()\n')
  chmodSync(executable, 0o755)

  const startedAt = Date.now()
  const proc = await PiRpcProcess.spawn({ cwd: dir, piCommand: executable, requestTimeoutMs: 40 })

  await assert.rejects(proc.getState(), /pi RPC get_state timed out after 40ms/)
  assert.ok(Date.now() - startedAt < 1_000)

  proc.dispose()
  assert.equal(await proc.waitForExit(), true)
})

test('PiRpcProcess retains a stderr tail for diagnostics (P1-3 audit)', async () => {
  const child = fakeChild()
  const proc = new PiRpcProcess(child, 30_000)
  child.stderr.write('warn one\n')
  child.stderr.write('warn two\n')
  await new Promise(r => setImmediate(r))
  assert.deepEqual(proc.stderrTailLines(10), ['warn one', 'warn two'])
})

test('PiRpcProcess stderr tail is bounded', async () => {
  const child = fakeChild()
  const proc = new PiRpcProcess(child, 30_000)
  for (let i = 0; i < 300; i++) child.stderr.write(`line ${i}\n`)
  await new Promise(r => setImmediate(r))
  const tail = proc.stderrTailLines()
  assert.ok(tail.length <= 40, `tail length ${tail.length}`)
  assert.equal(tail[0], 'line 260')
  assert.equal(tail[tail.length - 1], 'line 299')
})

function fakeChild(): any {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const handlers: Record<string, Array<(...a: unknown[]) => void>> = {}
  const child = {
    stdout,
    stderr,
    on(ev: string, fn: (...a: unknown[]) => void) {
      ;(handlers[ev] ??= []).push(fn)
      return child
    },
    once(ev: string, fn: (...a: unknown[]) => void) {
      ;(handlers[ev] ??= []).push(fn)
      return child
    }
  }
  return child
}

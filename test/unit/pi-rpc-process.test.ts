import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
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
  const dir = mkdtempSync(join(tmpdir(), 'pi-acp-stderr-'))
  const executable = join(dir, 'noisy-pi')
  writeFileSync(
    executable,
    '#!/usr/bin/env node\nprocess.stderr.write("warn one\\n")\nprocess.stderr.write("warn two\\n")\nprocess.stdin.resume()\n'
  )
  chmodSync(executable, 0o755)

  const proc = await PiRpcProcess.spawn({ cwd: dir, piCommand: executable, requestTimeoutMs: 40 })
  await new Promise(r => setTimeout(r, 80))
  assert.deepEqual(proc.stderrTailLines(10), ['warn one', 'warn two'])

  proc.dispose()
  await proc.waitForExit()
})

test('PiRpcProcess stderr tail is bounded', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-acp-stderr-'))
  const executable = join(dir, 'noisy-pi')
  const body = Array.from({ length: 300 }, (_, i) => `process.stderr.write('line ${i}\\n')`).join('\n')
  writeFileSync(executable, `#!/usr/bin/env node\n${body}\nprocess.stdin.resume()\n`)
  chmodSync(executable, 0o755)

  const proc = await PiRpcProcess.spawn({ cwd: dir, piCommand: executable, requestTimeoutMs: 40 })
  await new Promise(r => setTimeout(r, 80))
  const tail = proc.stderrTailLines()
  assert.ok(tail.length <= 40, `tail length ${tail.length}`)
  assert.equal(tail[0], 'line 260')
  assert.equal(tail[tail.length - 1], 'line 299')

  proc.dispose()
  await proc.waitForExit()
})

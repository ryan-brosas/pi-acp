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

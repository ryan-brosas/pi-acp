import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

test('ACP entrypoint: closing stdin waits for the owned pi subprocess to terminate', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-acp-shutdown-'))
  const signalFile = join(dir, 'signal.txt')
  const executable = join(dir, 'fake-pi')
  writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs')
const readline = require('node:readline')
const signalFile = process.env.PI_ACP_TEST_SIGNAL_FILE
process.on('SIGTERM', () => {
  fs.writeFileSync(signalFile, 'SIGTERM')
  process.exit(0)
})
readline.createInterface({ input: process.stdin }).on('line', line => {
  const msg = JSON.parse(line)
  if (msg.type === 'get_state') process.stdout.write(JSON.stringify({ type: 'response', id: msg.id, command: msg.type, success: true, data: {} }) + '\\n')
  if (msg.type === 'get_available_models') process.stdout.write(JSON.stringify({ type: 'response', id: msg.id, command: msg.type, success: true, data: { models: [{ provider: 'test', id: 'model', name: 'model' }] } }) + '\\n')
})
`
  )
  chmodSync(executable, 0o755)

  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PI_ACP_PI_COMMAND: executable, PI_ACP_TEST_SIGNAL_FILE: signalFile }
  })

  let stdout = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    stdout += chunk
  })
  child.stdin.write(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: 1 } }) + '\n'
  )
  child.stdin.write(
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'session/new', params: { cwd: dir, mcpServers: [] } }) + '\n'
  )

  try {
    await waitFor(() => stdout.split('\n').some(line => line.includes('"id":2')))
    child.stdin.end()
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('adapter did not exit')), 10_000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })

    assert.equal(existsSync(signalFile), true)
    assert.equal(readFileSync(signalFile, 'utf8'), 'SIGTERM')
  } finally {
    // Never leave the spawned adapter running: a hung child keeps the test
    // runner's stdio open and stalls the whole suite.
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
})

async function waitFor(predicate: () => boolean): Promise<void> {
  // 2.3s nominal; 10s headroom keeps this deterministic under loaded CI/IDE hosts.
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for session/new response')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

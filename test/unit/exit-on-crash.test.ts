import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { exitOnCrash } from '../../src/exit-on-crash.js'

describe('exitOnCrash', () => {
  it('logs the failure and exits 1 immediately without a disposer', () => {
    const exits: number[] = []
    exitOnCrash('uncaught exception', new Error('boom'), null, code => exits.push(code), 10)
    assert.deepEqual(exits, [1])
  })

  it('disposes owned children before exiting', async () => {
    const exits: number[] = []
    let disposed = 0
    exitOnCrash(
      'unhandled rejection',
      'nope',
      async () => {
        disposed += 1
      },
      code => exits.push(code),
      10
    )
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(disposed, 1)
    assert.deepEqual(exits, [1])
  })

  it('forces exit when the disposer hangs', async () => {
    const exits: number[] = []
    exitOnCrash(
      'uncaught exception',
      'hang',
      () => new Promise(() => {}),
      code => exits.push(code),
      10
    )
    await new Promise(resolve => setTimeout(resolve, 40))
    assert.deepEqual(exits, [1])
  })

  it('writes the failure detail and stack to stderr', () => {
    const chunks: string[] = []
    const originalWrite = process.stderr.write
    ;(process.stderr as any).write = (chunk: string) => {
      chunks.push(String(chunk))
      return true
    }
    try {
      const error = new Error('boom')
      exitOnCrash('uncaught exception', error, null, () => {}, 10)
      assert.ok(chunks[0].includes('pi-acp-jetbrain: uncaught exception'))
      assert.ok(chunks[0].includes('boom'))
      assert.ok(chunks[0].includes('exit-on-crash.test'))
    } finally {
      ;(process.stderr as any).write = originalWrite
    }
  })
})

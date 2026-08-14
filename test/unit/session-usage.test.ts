import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionStatsToAcpUsage, withTimeout } from '../../src/acp/usage.js'

test('sessionStatsToAcpUsage: maps pi token stats to ACP Usage', () => {
  const usage = sessionStatsToAcpUsage({
    tokens: { input: 100, output: 50, cacheRead: 25, cacheWrite: 10, total: 185 },
    cost: 0.012
  })
  assert.deepEqual(usage, {
    totalTokens: 185,
    inputTokens: 100,
    outputTokens: 50,
    cachedReadTokens: 25,
    cachedWriteTokens: 10,
    _meta: { piAcp: { cost: 0.012 } }
  })
})

test('sessionStatsToAcpUsage: derives total when pi omits it', () => {
  const usage = sessionStatsToAcpUsage({ tokens: { input: 7, output: 3 } })
  assert.equal(usage?.totalTokens, 10)
  assert.equal(usage?.inputTokens, 7)
  assert.equal(usage?.outputTokens, 3)
})

test('sessionStatsToAcpUsage: returns null for empty or malformed stats', () => {
  assert.equal(sessionStatsToAcpUsage(null), null)
  assert.equal(sessionStatsToAcpUsage({}), null)
  assert.equal(sessionStatsToAcpUsage({ tokens: null }), null)
  assert.equal(sessionStatsToAcpUsage({ tokens: { input: 0, output: 0, total: 0 } }), null)
})

test('sessionStatsToAcpUsage: omits cache fields and cost when absent', () => {
  const usage = sessionStatsToAcpUsage({ tokens: { input: 1, output: 2, total: 3 } })
  assert.deepEqual(usage, { totalTokens: 3, inputTokens: 1, outputTokens: 2 })
})

test('withTimeout: resolves with the promise value before the deadline', async () => {
  const value = await withTimeout(Promise.resolve('ok'), 500)
  assert.equal(value, 'ok')
})

test('withTimeout: rejects when the promise hangs past the deadline', async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 30),
    /timed out after 30ms/
  )
})

test('withTimeout: propagates promise rejection', async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 500), /boom/)
})
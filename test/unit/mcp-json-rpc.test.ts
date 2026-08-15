import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { settlePendingJsonRpcResponse } from '../../src/acp/mcp-json-rpc.js'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

function pendingRequest(): {
  pending: Map<string, PendingRequest>
  resolved: unknown[]
  rejected: Error[]
} {
  const resolved: unknown[] = []
  const rejected: Error[] = []
  const pending = new Map<string, PendingRequest>([
    [
      '7',
      {
        resolve: value => resolved.push(value),
        reject: error => rejected.push(error),
        timer: setTimeout(() => undefined, 60_000)
      }
    ]
  ])
  return { pending, resolved, rejected }
}

describe('settlePendingJsonRpcResponse', () => {
  it('resolves and removes a matching pending request', () => {
    const state = pendingRequest()

    assert.equal(settlePendingJsonRpcResponse({ id: 7, result: { ok: true } }, state.pending), true)
    assert.deepEqual(state.resolved, [{ ok: true }])
    assert.deepEqual(state.rejected, [])
    assert.equal(state.pending.size, 0)
  })

  it('rejects a matching pending request with the remote error', () => {
    const state = pendingRequest()

    assert.equal(
      settlePendingJsonRpcResponse({ id: 7, error: { code: -32_001, message: 'remote failure' } }, state.pending),
      true
    )
    assert.deepEqual(state.resolved, [])
    assert.match(state.rejected[0]?.message ?? '', /remote failure/)
    assert.equal(state.pending.size, 0)
  })

  it('ignores notifications and unknown request ids', () => {
    const state = pendingRequest()

    assert.equal(settlePendingJsonRpcResponse({ method: 'tools/list_changed' }, state.pending), false)
    assert.equal(settlePendingJsonRpcResponse({ id: 99, result: null }, state.pending), false)
    assert.equal(state.pending.size, 1)
    clearTimeout(state.pending.get('7')?.timer)
  })
})

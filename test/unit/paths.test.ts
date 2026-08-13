import test from 'node:test'
import assert from 'node:assert/strict'
import { getPiAcpSessionMapPath } from '../../src/acp/paths.js'

test('getPiAcpSessionMapPath honors PI_ACP_SESSION_MAP override', () => {
  const prev = process.env.PI_ACP_SESSION_MAP
  process.env.PI_ACP_SESSION_MAP = '/tmp/pi-acp-smoke-override/session-map.json'
  try {
    assert.equal(getPiAcpSessionMapPath(), '/tmp/pi-acp-smoke-override/session-map.json')
  } finally {
    if (prev === undefined) delete process.env.PI_ACP_SESSION_MAP
    else process.env.PI_ACP_SESSION_MAP = prev
  }
})

test('getPiAcpSessionMapPath defaults under ~/.pi/pi-acp', () => {
  const prev = process.env.PI_ACP_SESSION_MAP
  delete process.env.PI_ACP_SESSION_MAP
  try {
    assert.ok(getPiAcpSessionMapPath().endsWith('.pi/pi-acp/session-map.json'))
  } finally {
    if (prev !== undefined) process.env.PI_ACP_SESSION_MAP = prev
  }
})

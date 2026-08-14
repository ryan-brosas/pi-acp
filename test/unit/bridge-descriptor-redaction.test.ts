import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeBridgeDescriptors } from '../../src/acp/agent.js'

test('sanitizeBridgeDescriptors redacts nested env values by default (F-028)', () => {
  const out = sanitizeBridgeDescriptors([
    {
      name: 'idea',
      command: '/usr/local/bin/idea-mcp.sh',
      args: ['--token', 'a-very-secret-argument', '--port', '64442'],
      env: [
        { name: 'IJ_MCP_SERVER_PORT', value: '64442' },
        { name: 'IJ_MCP_SESSION_ID', value: 'chat-1' },
        { name: 'IJ_MCP_AUTH_TOKEN', value: 'tok-1234567890' },
        { name: 'FAKE_SECRET', value: 'sk-sentinel-0123456789012345678901234567890123456789' }
      ]
    }
  ]) as Array<{ command?: string; args?: string; env?: Array<{ name?: string; value?: string }> }>
  assert.equal(out.length, 1)
  const server = out[0]
  assert.equal(server.command, 'idea-mcp.sh')
  assert.equal(server.args, '[4 arg(s), redacted]')
  const env = server.env ?? []
  assert.equal(env.find(e => e?.name === 'IJ_MCP_SERVER_PORT')?.value, '64442')
  assert.equal(env.find(e => e?.name === 'IJ_MCP_SESSION_ID')?.value, 'chat-1')
  assert.ok(env.find(e => e?.name === 'IJ_MCP_AUTH_TOKEN')?.value?.startsWith('[redacted '))
  assert.ok(env.find(e => e?.name === 'FAKE_SECRET')?.value?.startsWith('[redacted '))
  const json = JSON.stringify(out)
  assert.ok(!json.includes('tok-1234567890'))
  assert.ok(!json.includes('sk-sentinel'))
  assert.ok(!json.includes('a-very-secret-argument'))
})

test('sanitizeBridgeDescriptors handles non-array env and empty values', () => {
  const out = sanitizeBridgeDescriptors([
    { name: 'x', command: 'x', args: [], env: 'not-an-array' }
  ] as never[]) as Array<{
    env?: unknown
  }>
  assert.equal(out[0].env, '[redacted non-array env]')
  const out2 = sanitizeBridgeDescriptors([
    { name: 'y', command: 'y', args: [], env: [{ name: 'EMPTY', value: '' }] }
  ]) as Array<{ env?: Array<{ name?: string; value?: string }> }>
  assert.equal(out2[0].env?.[0]?.value, undefined)
})

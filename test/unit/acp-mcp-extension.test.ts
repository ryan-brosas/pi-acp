import { describe, it } from 'node:test'
import { EventEmitter } from 'node:events'
import type { Socket } from 'node:net'
import assert from 'node:assert/strict'
import { Check } from 'typebox/value'
import {
  schemaToTypeBox,
  mcpResultToPiResult,
  McpToolError,
  prepareToolArguments,
  claimBridgeInstance,
  releaseBridgeInstance,
  createAcpMcpBridgeExtension
} from '../../src/pi-extension/acp-mcp-bridge.js'

describe('ACP MCP Pi extension conversion', () => {
  it('injects the ACP project path only for tools that declare projectPath', () => {
    const tool = {
      inputSchema: {
        type: 'object',
        properties: { projectPath: { type: 'string' }, query: { type: 'string' } }
      }
    }
    const args = { query: 'AcpMcpBridge' }
    assert.deepEqual(prepareToolArguments(tool, args, '/workspace/project'), {
      query: 'AcpMcpBridge',
      projectPath: '/workspace/project'
    })
    assert.deepEqual(args, { query: 'AcpMcpBridge' })
    assert.deepEqual(
      prepareToolArguments(tool, { query: 'AcpMcpBridge', projectPath: '/explicit/ide-project' }, '/workspace/project'),
      { query: 'AcpMcpBridge', projectPath: '/explicit/ide-project' }
    )
    assert.deepEqual(prepareToolArguments({ inputSchema: { type: 'object' } }, {}, '/workspace/project'), {})
  })

  it('preserves required nested schema constraints and rejects invalid input', () => {
    const schema = schemaToTypeBox({
      type: 'object',
      additionalProperties: false,
      required: ['path', 'mode'],
      properties: {
        path: { type: 'string', minLength: 1, format: 'uri-reference' },
        mode: { enum: ['read', 'write'] },
        options: {
          type: 'object',
          required: ['recursive'],
          properties: { recursive: { type: 'boolean' } }
        },
        tags: { type: 'array', items: { type: 'string' } }
      }
    })

    assert.equal(Check(schema, { path: 'src/a.ts', mode: 'read', options: { recursive: true }, tags: ['ide'] }), true)
    assert.equal(Check(schema, { path: 'src/a.ts', mode: 'other' }), false)
    assert.equal(Check(schema, { mode: 'read' }), false)
  })

  it('supports const, unions, nullable values, and nested arrays', () => {
    const schema = schemaToTypeBox({
      type: 'object',
      required: ['kind', 'value'],
      properties: {
        kind: { const: 'symbol' },
        value: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        paths: { type: 'array', items: { type: 'array', items: { type: 'string' } } }
      }
    })
    assert.equal(Check(schema, { kind: 'symbol', value: null, paths: [['a.ts']] }), true)
    assert.equal(Check(schema, { kind: 'file', value: 1, paths: [] }), false)
  })

  it('resolves bounded local references and tuple items', () => {
    const schema = schemaToTypeBox({
      type: 'object',
      required: ['mode', 'pair'],
      properties: {
        mode: { $ref: '#/$defs/mode' },
        pair: { $ref: '#/$defs/pair' }
      },
      $defs: {
        mode: { enum: ['read', 'write'] },
        pair: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'integer' }] }
      }
    })
    assert.equal(Check(schema, { mode: 'read', pair: ['src/a.ts', 1] }), true)
    assert.equal(Check(schema, { mode: 'other', pair: ['src/a.ts', '1'] }), false)
  })

  it('maps MCP content and structured details without fetching resources', () => {
    const result = mcpResultToPiResult({
      content: [
        { type: 'text', text: 'diagnostics' },
        { type: 'resource_link', uri: 'file:///tmp/private.ts' }
      ],
      structuredContent: { count: 1 },
      _meta: { requestId: 'safe-id' }
    })
    assert.equal(result.content[0].type, 'text')
    assert.match((result.content[1] as { text: string }).text, /resource link/)
    assert.deepEqual(result.details.structuredContent, { count: 1 })
  })

  it('rejects MCP isError results and malformed results', () => {
    assert.throws(() => mcpResultToPiResult({ isError: true, content: [{ type: 'text', text: 'bad' }] }), McpToolError)
    assert.throws(() => mcpResultToPiResult('bad'), McpToolError)
  })
})

it('dedupes factory activation and permits reactivation after session shutdown', () => {
  class FakeSocket extends EventEmitter {
    destroyed = false
    readonly writes: string[] = []

    setEncoding(): this {
      return this
    }

    write(data: string): boolean {
      this.writes.push(data)
      return true
    }

    destroy(): this {
      if (this.destroyed) return this
      this.destroyed = true
      this.emit('close')
      return this
    }
  }

  const scope = {}
  const sockets: FakeSocket[] = []
  const registeredTools: string[] = []
  const shutdownHandlers: Array<() => void> = []
  const pi = {
    on(event: string, handler: () => void) {
      if (event === 'session_shutdown') shutdownHandlers.push(handler)
    },
    registerTool(tool: { name: string }) {
      registeredTools.push(tool.name)
    }
  }
  const makeExtension = () =>
    createAcpMcpBridgeExtension({
      endpoint: '/tmp/pi-acp-test.sock',
      token: 'test-token',
      sessionId: 'test-session',
      instanceScope: scope,
      connect: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket as unknown as Socket
      }
    })

  makeExtension()(pi as never)
  makeExtension()(pi as never)
  assert.equal(sockets.length, 1)

  sockets[0].emit('connect')
  sockets[0].emit(
    'data',
    Buffer.from(
      `${JSON.stringify({
        type: 'hello_ack',
        catalog: {
          catalogId: 'test-catalog',
          tools: [
            {
              exposedName: 'ide_fixture_echo',
              connectionId: 'fixture',
              remoteName: 'echo',
              inputSchema: { type: 'object', properties: {} }
            }
          ]
        }
      })}\n`
    )
  )
  assert.deepEqual(registeredTools, ['ide_fixture_echo'])

  shutdownHandlers[0]()
  makeExtension()(pi as never)
  assert.equal(sockets.length, 2)
})

describe('ACP MCP Pi extension lifecycle', () => {
  it('allows one bridge instance and releases only the current owner', () => {
    const scope = {}
    const first = Symbol('first')
    const second = Symbol('second')

    assert.equal(claimBridgeInstance(scope, first), true)
    assert.equal(claimBridgeInstance(scope, second), false)

    releaseBridgeInstance(scope, second)
    assert.equal(claimBridgeInstance(scope, second), false)

    releaseBridgeInstance(scope, first)
    assert.equal(claimBridgeInstance(scope, second), true)
    releaseBridgeInstance(scope, second)
  })
})

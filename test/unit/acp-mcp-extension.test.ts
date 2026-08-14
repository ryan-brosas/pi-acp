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

// ---------- IntelliJ-first coding mode ----------

import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parsePatchTargets } from '../../src/pi-extension/acp-mcp-bridge.js'

function makeFakeRuntime(
  initialActive: string[] = ['read', 'edit', 'write', 'grep', 'find', 'ls', 'bash', 'my_ext_tool']
) {
  const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>()
  const all = new Set<string>(initialActive)
  let active = [...initialActive]
  const registered: any[] = []
  const pi = {
    on(event: string, handler: (event: any, ctx: any) => unknown) {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    },
    registerTool(def: { name: string }) {
      all.add(def.name)
      registered.push(def)
    },
    getActiveTools: () => [...active],
    getAllTools: () => [...all].map(name => ({ name })),
    setActiveTools(names: string[]) {
      active = [...names]
    }
  }
  return {
    pi: pi as never,
    handlers,
    registered,
    get active() {
      return [...active]
    }
  }
}

class FakeIdeSocket extends EventEmitter {
  destroyed = false
  readonly writes: string[] = []
  calls: Array<{ id: string; tool: string; args: Record<string, unknown> }> = []
  replyValue: unknown = { content: [{ type: 'text', text: 'ok' }] }
  noReplyTools = new Set<string>()

  setEncoding(): this {
    return this
  }

  write(data: string): boolean {
    this.writes.push(data)
    let msg: any
    try {
      msg = JSON.parse(data)
    } catch {
      return true
    }
    if (msg.type === 'call') {
      this.calls.push({ id: msg.id, tool: msg.tool, args: msg.args })
      if (!this.noReplyTools.has(msg.tool)) {
        this.emit('data', Buffer.from(JSON.stringify({ type: 'result', id: msg.id, result: this.replyValue }) + '\n'))
      }
    }
    return true
  }

  destroy(): this {
    if (this.destroyed) return this
    this.destroyed = true
    this.emit('close')
    return this
  }
}

function ideTool(remoteName: string, exposedName: string, properties: Record<string, unknown> = {}): any {
  return {
    exposedName,
    connectionId: 'idea',
    remoteName,
    inputSchema: { type: 'object', properties },
    schemaHash: 'h:' + remoteName
  }
}

const FULL_CATALOG = [
  ideTool('read_file', 'ide_idea_read_file', { filePath: { type: 'string' } }),
  ideTool('open_file_in_editor', 'ide_idea_open_file', { filePath: { type: 'string' } }),
  ideTool('apply_patch', 'ide_idea_apply_patch', { patch: { type: 'string' } }),
  ideTool('create_new_file', 'ide_idea_create_new_file', { filePath: { type: 'string' } }),
  ideTool('skill_search', 'ide_idea_skill_search', { query: { type: 'string' } }),
  ideTool('lint_files', 'ide_idea_lint_files', { files: { type: 'array', items: { type: 'string' } } }),
  ideTool('rename_refactoring', 'ide_idea_rename_refactoring', {
    pathInProject: { type: 'string' },
    newName: { type: 'string' }
  }),
  ideTool('reformat_file', 'ide_idea_reformat_file', { files: { type: 'array', items: { type: 'string' } } })
]

function wireExtension(
  mode: string | undefined,
  catalogTools: any[],
  initialActive?: string[],
  projectPath = '/workspace/project'
) {
  const rt = makeFakeRuntime(initialActive)
  const socket = new FakeIdeSocket()
  const prevMode = process.env.PI_ACP_IDE_MODE
  if (mode === undefined) delete process.env.PI_ACP_IDE_MODE
  else process.env.PI_ACP_IDE_MODE = mode
  const ext = createAcpMcpBridgeExtension({
    endpoint: '/tmp/test.sock',
    token: 't',
    sessionId: 's',
    instanceScope: {},
    connect: () => socket as unknown as Socket
  })
  ext(rt.pi)
  if (prevMode === undefined) delete process.env.PI_ACP_IDE_MODE
  else process.env.PI_ACP_IDE_MODE = prevMode
  socket.emit('connect')
  const emitCatalog = () =>
    socket.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          type: 'hello_ack',
          catalog: { catalogId: 'c', projectPath, tools: catalogTools }
        }) + '\n'
      )
    )
  return { rt, socket, emitCatalog }
}

async function guidanceFor(mode: string, catalog: any[], afterCatalog = true) {
  const { rt, socket, emitCatalog } = wireExtension(mode, catalog)
  if (afterCatalog) emitCatalog()
  let result: unknown
  for (const handler of rt.handlers.get('before_agent_start') ?? []) {
    const r = await handler({ systemPrompt: 'base' }, null)
    if (r !== undefined) result = r
  }
  return { guidance: result as { systemPrompt: string } | undefined, socket }
}

describe('IntelliJ-first coding mode policy', () => {
  it('off mode preserves active tools and raw execution', async () => {
    const { rt, socket, emitCatalog } = wireExtension('off', FULL_CATALOG)
    emitCatalog()
    assert.deepEqual(rt.active, ['read', 'edit', 'write', 'grep', 'find', 'ls', 'bash', 'my_ext_tool'])
    const apply = rt.registered.find((t: any) => t.name === 'ide_idea_apply_patch')
    const result = await apply.execute('t1', { patch: '--- a/src/a.ts\n+++ b/src/a.ts\n' })
    assert.equal(socket.calls.length, 1)
    assert.equal(socket.calls[0].tool, 'ide_idea_apply_patch')
    assert.equal(result.content[0].text, 'ok')
  })

  it('prefer removes native file tools only when the catalog is complete', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    assert.ok(rt.active.includes('read'))
    emitCatalog()
    const natives = ['read', 'edit', 'write', 'grep', 'find', 'ls']
    assert.deepEqual(
      rt.active.filter(n => natives.includes(n)),
      []
    )
    assert.ok(rt.active.includes('bash'))
    assert.ok(rt.active.includes('my_ext_tool'))
    assert.ok(rt.active.includes('ide_idea_read_file'))
    const regMsg = socket.writes.map(w => JSON.parse(w)).find((m: any) => m.type === 'catalog_registered')
    assert.ok((regMsg.registration.diagnostics as string[]).some(d => d.includes('IDE coding mode')))
  })

  it('required removes native file tools before the catalog arrives', () => {
    const { rt } = wireExtension('required', FULL_CATALOG)
    const natives = ['read', 'edit', 'write', 'grep', 'find', 'ls']
    assert.deepEqual(
      rt.active.filter(n => natives.includes(n)),
      []
    )
  })

  it('prefer restores native tools when required capabilities are missing', async () => {
    const partial = FULL_CATALOG.filter(t => t.remoteName !== 'apply_patch')
    const { rt, emitCatalog } = wireExtension('prefer', partial)
    emitCatalog()
    assert.ok(rt.active.includes('read'))
  })

  it('required stays fail closed when required capabilities are missing', async () => {
    const partial = FULL_CATALOG.filter(t => t.remoteName !== 'apply_patch')
    const { rt, emitCatalog } = wireExtension('required', partial)
    emitCatalog()
    assert.ok(!rt.active.includes('read'))
  })

  it('activation preserves unrelated extension tools', async () => {
    const { rt, emitCatalog } = wireExtension('prefer', FULL_CATALOG, ['read', 'edit', 'bash', 'my_ext_tool'])
    emitCatalog()
    assert.ok(rt.active.includes('my_ext_tool'))
    assert.ok(rt.active.includes('bash'))
  })

  it('fallback restores only tools removed by this policy', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG, ['read', 'edit', 'bash', 'my_ext_tool'])
    emitCatalog()
    assert.ok(!rt.active.includes('read'))
    socket.emit('close')
    assert.ok(rt.active.includes('read'))
    assert.ok(rt.active.includes('edit'))
    assert.ok(rt.active.includes('bash'))
    assert.ok(rt.active.includes('my_ext_tool'))
  })

  it('disconnect removes IDE tools from the active set', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    assert.ok(rt.active.includes('ide_idea_read_file'))
    socket.emit('close')
    assert.ok(!rt.active.includes('ide_idea_read_file'))
  })

  it('new IDE calls after disconnect fail immediately without pending entries', async () => {
    const { rt, socket, emitCatalog } = wireExtension('off', FULL_CATALOG)
    emitCatalog()
    socket.emit('close')
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    await assert.rejects(() => read.execute('x1', { filePath: 'src/a.ts' }), /disconnected/)
    assert.equal(socket.calls.length, 0)
  })

  it('repeated disconnect is idempotent', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    socket.emit('close')
    const snapshot = [...rt.active].sort()
    socket.emit('close')
    assert.deepEqual([...rt.active].sort(), snapshot)
  })

  it('guidance matches active state and uses exposed names', async () => {
    const { guidance } = await guidanceFor('prefer', FULL_CATALOG)
    assert.ok(guidance, 'guidance returned')
    assert.ok(guidance.systemPrompt.startsWith('base'))
    assert.match(guidance.systemPrompt, /IntelliJ-first mode is active/)
    assert.match(guidance.systemPrompt, /ide_idea_read_file/)
    assert.match(guidance.systemPrompt, /ide_idea_apply_patch/)
    assert.match(guidance.systemPrompt, /ide_idea_lint_files/)
    assert.ok(!guidance.systemPrompt.includes('ide_idea_nonexistent'))
  })

  it('guidance reflects fallback state', async () => {
    const partial = FULL_CATALOG.filter(t => t.remoteName !== 'apply_patch')
    const { guidance } = await guidanceFor('prefer', partial)
    assert.ok(guidance)
    assert.match(guidance.systemPrompt, /IDE IPC|bridge.*unavailable|unavailable/i)
  })

  it('guidance reflects required-unavailable state', async () => {
    const partial = FULL_CATALOG.filter(t => t.remoteName !== 'apply_patch')
    const { guidance } = await guidanceFor('required', partial)
    assert.ok(guidance)
    assert.match(guidance.systemPrompt, /blocked|unavailable/i)
  })

  it('parses unified diff headers for update, add, delete, and spaces', () => {
    const patch = [
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '--- /dev/null',
      '+++ b/src/new.ts',
      '--- a/src/old.ts',
      '+++ /dev/null',
      '--- a/my file.ts',
      '+++ b/my file.ts'
    ].join('\n')
    const targets = parsePatchTargets(patch)
    const byPath = new Map(targets.map(t => [t.destination, t]))
    assert.equal(byPath.get('src/a.ts')?.kind, 'update')
    assert.equal(byPath.get('src/new.ts')?.kind, 'add')
    assert.equal(byPath.get('src/old.ts')?.kind, 'delete')
    assert.equal(byPath.get('my file.ts')?.kind, 'update')
  })

  it('parses codex patch directives for add, update, delete, and move', () => {
    const patch = [
      '*** Begin Patch',
      '*** Update File: src/a.ts',
      '*** Add File: src/b.ts',
      '*** Delete File: src/c.ts',
      '*** Update File: src/d.ts',
      '*** Move to: src/d2.ts',
      '*** End Patch'
    ].join('\n')
    const targets = parsePatchTargets(patch)
    const byPath = new Map(targets.map(t => [t.destination, t]))
    assert.equal(byPath.get('src/a.ts')?.kind, 'update')
    assert.equal(byPath.get('src/b.ts')?.kind, 'add')
    assert.equal(byPath.get('src/c.ts')?.kind, 'delete')
    assert.equal(byPath.get('src/d2.ts')?.kind, 'move')
    assert.equal(byPath.get('src/d2.ts')?.source, 'src/d.ts')
  })

  it('apply_patch opens existing targets before mutation and added files after', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const apply = rt.registered.find((t: any) => t.name === 'ide_idea_apply_patch')
    const patch = ['--- a/src/a.ts', '+++ b/src/a.ts', '--- /dev/null', '+++ b/src/b.ts'].join('\n')
    await apply.execute('t9', { patch })
    assert.equal(socket.calls[0].tool, 'ide_idea_open_file')
    assert.equal(socket.calls[0].args.filePath, 'src/a.ts')
    assert.equal(socket.calls[1].tool, 'ide_idea_apply_patch')
    assert.equal(socket.calls[2].tool, 'ide_idea_open_file')
    assert.equal(socket.calls[2].args.filePath, 'src/b.ts')
    assert.match(socket.calls[0].id, /:open:0$/)
    assert.match(socket.calls[1].id, /:mutate$/)
    assert.match(socket.calls[2].id, /:open-created:0$/)
    const ids = socket.calls.map(c => c.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  it('deleted files are opened before but not after mutation', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const apply = rt.registered.find((t: any) => t.name === 'ide_idea_apply_patch')
    const patch = ['--- a/src/del.ts', '+++ /dev/null'].join('\n')
    await apply.execute('t16', { patch })
    assert.equal(socket.calls.length, 2)
    assert.equal(socket.calls[0].tool, 'ide_idea_open_file')
    assert.equal(socket.calls[0].args.filePath, 'src/del.ts')
    assert.equal(socket.calls[1].tool, 'ide_idea_apply_patch')
  })

  it('rename opens the source file before refactoring', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const rename = rt.registered.find((t: any) => t.name === 'ide_idea_rename_refactoring')
    await rename.execute('t17', { pathInProject: 'src/sym.ts', newName: 'newName' })
    assert.equal(socket.calls[0].tool, 'ide_idea_open_file')
    assert.equal(socket.calls[0].args.filePath, 'src/sym.ts')
    assert.equal(socket.calls[1].tool, 'ide_idea_rename_refactoring')
    assert.equal(socket.calls.length, 2)
  })

  it('create opens the file after creation only', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const create = rt.registered.find((t: any) => t.name === 'ide_idea_create_new_file')
    await create.execute('t18', { filePath: 'src/new.ts' })
    assert.equal(socket.calls[0].tool, 'ide_idea_create_new_file')
    assert.equal(socket.calls[1].tool, 'ide_idea_open_file')
    assert.equal(socket.calls[1].args.filePath, 'src/new.ts')
  })

  it('reformat opens all target files first', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const reformat = rt.registered.find((t: any) => t.name === 'ide_idea_reformat_file')
    await reformat.execute('t19', { files: ['src/a.ts', 'src/b.ts'] })
    assert.equal(socket.calls[0].tool, 'ide_idea_open_file')
    assert.equal(socket.calls[1].tool, 'ide_idea_open_file')
    assert.equal(socket.calls[2].tool, 'ide_idea_reformat_file')
  })

  it('rejects outside-root mutation paths before any call', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const apply = rt.registered.find((t: any) => t.name === 'ide_idea_apply_patch')
    const patch = ['--- a/../../etc/passwd', '+++ b/../../etc/passwd'].join('\n')
    await assert.rejects(() => apply.execute('t21', { patch }), /outside|escape|root/i)
    assert.equal(socket.calls.length, 0)
  })

  it('rejects traversal in create paths', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const create = rt.registered.find((t: any) => t.name === 'ide_idea_create_new_file')
    await assert.rejects(() => create.execute('t22', { filePath: '../../x.ts' }), /outside|escape|root/i)
    assert.equal(socket.calls.length, 0)
  })

  it('rejects symlink escapes for existing mutation targets', async () => {
    const proj = mkdtempSync(join(tmpdir(), 'piap-'))
    const outside = mkdtempSync(join(tmpdir(), 'piap-out-'))
    mkdirSync(join(proj, 'src'))
    writeFileSync(join(proj, 'src', 'a.ts'), 'x')
    symlinkSync(outside, join(proj, 'link'), 'dir')
    try {
      const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG, undefined, proj)
      emitCatalog()
      const apply = rt.registered.find((t: any) => t.name === 'ide_idea_apply_patch')
      const patch = ['--- a/link/evil.ts', '+++ b/link/evil.ts'].join('\n')
      await assert.rejects(() => apply.execute('t23', { patch }), /outside|escape|root/i)
      assert.equal(socket.calls.length, 0)
    } finally {
      rmSync(proj, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('annotates out-of-root semantic results in prefer', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    socket.replyValue = {
      content: [{ type: 'text', text: 'tree' }],
      structuredContent: { files: ['/other/repo/x.ts'] }
    }
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    const result = await read.execute('t24', { filePath: 'src/a.ts' })
    assert.ok(JSON.stringify(result.details).toLowerCase().includes('outside'))
  })

  it('rejects out-of-root semantic results in required', async () => {
    const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG)
    socket.replyValue = {
      content: [{ type: 'text', text: 'tree' }],
      structuredContent: { files: ['/other/repo/x.ts'] }
    }
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    await assert.rejects(() => read.execute('t24b', { filePath: 'src/a.ts' }), /outside|root/i)
  })

  it('cancellation during a pending call cleans pending state', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    socket.noReplyTools.add('ide_idea_read_file')
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    const ac = new AbortController()
    const p = read.execute('t27', { filePath: 'src/a.ts' }, ac.signal)
    await new Promise(resolve => setTimeout(resolve, 10))
    ac.abort()
    await assert.rejects(() => p, /cancelled/)
    const cancelMsg = socket.writes.map(w => JSON.parse(w)).find((m: any) => m.type === 'cancel' && m.id === 't27')
    assert.ok(cancelMsg)
    socket.noReplyTools.delete('ide_idea_read_file')
    const again = await read.execute('t27b', { filePath: 'src/a.ts' })
    assert.equal(again.content[0].text, 'ok')
  })

  it('rejects symlink escapes for delete targets', async () => {
    const proj = mkdtempSync(join(tmpdir(), 'piap-'))
    const outside = mkdtempSync(join(tmpdir(), 'piap-out-'))
    mkdirSync(join(proj, 'src'))
    symlinkSync(outside, join(proj, 'link'), 'dir')
    try {
      const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG, undefined, proj)
      emitCatalog()
      const apply = rt.registered.find((t: any) => t.name === 'ide_idea_apply_patch')
      const patch = ['--- a/link/evil.ts', '+++ /dev/null'].join('\n')
      await assert.rejects(() => apply.execute('t23d', { patch }), /outside|escape|root/i)
      assert.equal(socket.calls.length, 0)
    } finally {
      rmSync(proj, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('guidance reflects awaiting-catalog state before registration', async () => {
    const prefer = await guidanceFor('prefer', FULL_CATALOG, false)
    assert.ok(prefer.guidance)
    assert.match(prefer.guidance.systemPrompt, /not ready yet|waiting/i)
    const req = await guidanceFor('required', FULL_CATALOG, false)
    assert.ok(req.guidance)
    assert.match(req.guidance.systemPrompt, /stay disabled|waiting/i)
  })

  it('required without credentials does not throw on shutdown', () => {
    const prevMode = process.env.PI_ACP_IDE_MODE
    process.env.PI_ACP_IDE_MODE = 'required'
    const rt = makeFakeRuntime()
    const ext = createAcpMcpBridgeExtension({ instanceScope: {} })
    try {
      ext(rt.pi)
    } finally {
      if (prevMode === undefined) delete process.env.PI_ACP_IDE_MODE
      else process.env.PI_ACP_IDE_MODE = prevMode
    }
    const natives = ['read', 'edit', 'write', 'grep', 'find', 'ls']
    assert.deepEqual(
      rt.active.filter(n => natives.includes(n)),
      []
    )
    for (const handler of rt.handlers.get('session_shutdown') ?? []) {
      assert.doesNotThrow(() => handler({}, null))
    }
  })

  it('write returning false is backpressure, not failure', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    socket.write = function (data: string): boolean {
      this.writes.push(data)
      const msg = JSON.parse(data)
      if (msg.type === 'call') {
        this.calls.push({ id: msg.id, tool: msg.tool, args: msg.args })
        this.emit('data', Buffer.from(JSON.stringify({ type: 'result', id: msg.id, result: this.replyValue }) + '\n'))
      }
      return false
    }
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    const result = await read.execute('bp1', { filePath: 'src/a.ts' })
    assert.equal(result.content[0].text, 'ok')
    assert.equal(socket.calls.length, 1)
  })

  it('does not parse hunk content lines as file headers', () => {
    const patch = [
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,3 +1,3 @@',
      '-old',
      '+new',
      '+++ this line is content, not a header',
      '--- not a header either'
    ].join('\n')
    const targets = parsePatchTargets(patch)
    assert.equal(targets.length, 1)
    assert.equal(targets[0].kind, 'update')
    assert.equal(targets[0].destination, 'src/a.ts')
  })

  it('detects nested out-of-root result paths', async () => {
    const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG)
    socket.replyValue = {
      content: [{ type: 'text', text: 'tree' }],
      structuredContent: { results: [{ filePath: '/other/repo/x.ts' }] }
    }
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    await assert.rejects(() => read.execute('t24c', { filePath: 'src/a.ts' }), /outside|root/i)
  })
  it('ignores reversed hunk content that mimics headers', () => {
    const patch = [
      '--- a/src/real.ts',
      '+++ b/src/real.ts',
      '@@ -1,1 +1,1 @@',
      '--- bogus-old',
      '+++ bogus-new',
      '--- a/src/real2.ts',
      '+++ b/src/real2.ts'
    ].join('\n')
    const targets = parsePatchTargets(patch)
    assert.deepEqual(
      targets.map(t => t.kind + ':' + t.destination),
      ['update:src/real.ts', 'update:src/real2.ts']
    )
  })

  it('rejects relative traversal in result paths', async () => {
    const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG)
    socket.replyValue = {
      content: [{ type: 'text', text: 'hits' }],
      structuredContent: { files: ['../../outside.ts'] }
    }
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    await assert.rejects(() => read.execute('t24d', { filePath: 'src/a.ts' }), /outside|root/i)
  })

  it('rejects symlink-escaping result paths', async () => {
    const proj = mkdtempSync(join(tmpdir(), 'piap-'))
    const outside = mkdtempSync(join(tmpdir(), 'piap-out-'))
    symlinkSync(outside, join(proj, 'link'), 'dir')
    try {
      const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG, undefined, proj)
      socket.replyValue = {
        content: [{ type: 'text', text: 'hits' }],
        structuredContent: { filePath: join(proj, 'link', 'x.ts') }
      }
      emitCatalog()
      const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
      await assert.rejects(() => read.execute('t24e', { filePath: 'src/a.ts' }), /outside|escape|root/i)
    } finally {
      rmSync(proj, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('confinement applies to create_new_file path arguments', async () => {
    const catalog = FULL_CATALOG.map(t =>
      t.remoteName === 'create_new_file'
        ? ideTool('create_new_file', 'ide_idea_create_path_file', { path: { type: 'string' } })
        : t
    )
    const { rt, socket, emitCatalog } = wireExtension('prefer', catalog)
    emitCatalog()
    const create = rt.registered.find((t: any) => t.name === 'ide_idea_create_path_file')
    await assert.rejects(() => create.execute('t22b', { path: '../../x.ts' }), /outside|escape|root/i)
    assert.equal(socket.calls.length, 0)
    const result = await create.execute('t22c', { path: 'src/new.ts' })
    assert.equal(result.content[0].text, 'ok')
    assert.equal(socket.calls[0].tool, 'ide_idea_create_path_file')
    assert.equal(socket.calls[1].tool, 'ide_idea_open_file')
    assert.equal(socket.calls[1].args.filePath, 'src/new.ts')
  })
  it('context-bearing hunks do not swallow following headers', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const apply = rt.registered.find((t: any) => t.name === 'ide_idea_apply_patch')
    const patch = [
      '--- a/src/keep.ts',
      '+++ b/src/keep.ts',
      '@@ -1,3 +1,3 @@',
      ' context1',
      ' context2',
      '-old',
      '+new',
      '--- a/../../outside.ts',
      '+++ b/../../outside.ts'
    ].join('\n')
    await assert.rejects(() => apply.execute('t25h', { patch }), /outside|escape|root/i)
    assert.equal(socket.calls.length, 0)
  })

  it('confinement applies to read_file path arguments', async () => {
    const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG)
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    await assert.rejects(() => read.execute('t25a', { filePath: '../../x.ts' }), /outside|escape|root/i)
    assert.equal(socket.calls.length, 0)
  })

  it('confinement applies to array path arguments on inspection tools', async () => {
    const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG)
    emitCatalog()
    const lint = rt.registered.find((t: any) => t.name === 'ide_idea_lint_files')
    await assert.rejects(() => lint.execute('t25c', { files: ['src/a.ts', '../x.ts'] }), /outside|escape|root/i)
    assert.equal(socket.calls.length, 0)
  })

  it('rejects symlink escapes on read calls', async () => {
    const proj = mkdtempSync(join(tmpdir(), 'piap-'))
    const outside = mkdtempSync(join(tmpdir(), 'piap-out-'))
    symlinkSync(outside, join(proj, 'link'), 'dir')
    try {
      const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG, undefined, proj)
      emitCatalog()
      const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
      await assert.rejects(() => read.execute('t25b', { filePath: join(proj, 'link', 'x.ts') }), /outside|escape|root/i)
      assert.equal(socket.calls.length, 0)
    } finally {
      rmSync(proj, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('codex content resembling directives is ignored', () => {
    const patch = [
      '*** Begin Patch',
      '*** Update File: src/a.ts',
      'this is the content',
      ' *** Add File: documentation text inside content',
      '*** End Patch'
    ].join('\n')
    const targets = parsePatchTargets(patch)
    assert.deepEqual(
      targets.map(t => t.kind + ':' + t.destination),
      ['update:src/a.ts']
    )
  })
  it('catalog without a project root keeps prefer in fallback', async () => {
    const { rt, emitCatalog } = wireExtension('prefer', FULL_CATALOG, undefined, '')
    emitCatalog()
    assert.ok(rt.active.includes('read'))
  })

  it('catalog without a project root keeps required fail closed', async () => {
    const { rt, emitCatalog } = wireExtension('required', FULL_CATALOG, undefined, '')
    emitCatalog()
    assert.ok(!rt.active.includes('read'))
  })

  it('every mutation path argument is confined', async () => {
    const catalog = FULL_CATALOG.map(t =>
      t.remoteName === 'create_new_file'
        ? ideTool('create_new_file', 'ide_idea_create_two_paths', {
            filePath: { type: 'string' },
            path: { type: 'string' }
          })
        : t
    )
    const { rt, socket, emitCatalog } = wireExtension('prefer', catalog)
    emitCatalog()
    const create = rt.registered.find((t: any) => t.name === 'ide_idea_create_two_paths')
    await assert.rejects(
      () => create.execute('t25m', { filePath: 'src/ok.ts', path: '../../evil.ts' }),
      /outside|escape|root/i
    )
    assert.equal(socket.calls.length, 0)
  })
  it('detects deeply nested out-of-root result paths', async () => {
    const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG)
    socket.replyValue = {
      content: [{ type: 'text', text: 'hits' }],
      structuredContent: {
        groups: [{ results: [{ matches: [{ filePath: '/other/repo/x.ts' }] }] }]
      }
    }
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    await assert.rejects(() => read.execute('t24f', { filePath: 'src/a.ts' }), /outside|root/i)
  })
  it('rejects results truncated by depth in required mode', async () => {
    let leaf: Record<string, unknown> = { filePath: 'src/ok.ts' }
    for (let i = 0; i < 18; i++) leaf = { child: leaf }
    const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG)
    socket.replyValue = { content: [{ type: 'text', text: 'x' }], structuredContent: { top: leaf } }
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    await assert.rejects(() => read.execute('t24g', { filePath: 'src/a.ts' }), /scoped|outside|root|truncated/i)
  })

  it('annotates results truncated by depth in prefer mode', async () => {
    let leaf: Record<string, unknown> = { filePath: 'src/ok.ts' }
    for (let i = 0; i < 18; i++) leaf = { child: leaf }
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    socket.replyValue = { content: [{ type: 'text', text: 'x' }], structuredContent: { top: leaf } }
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    const result = await read.execute('t24h', { filePath: 'src/a.ts' })
    assert.ok(JSON.stringify(result.details).includes('truncated'))
  })

  it('rejects results exceeding the node budget in required mode', async () => {
    const { rt, socket, emitCatalog } = wireExtension('required', FULL_CATALOG)
    socket.replyValue = {
      content: [{ type: 'text', text: 'x' }],
      structuredContent: { groups: Array.from({ length: 6000 }, () => ({ meta: { x: 1 } })) }
    }
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    await assert.rejects(() => read.execute('t24i', { filePath: 'src/a.ts' }), /scoped|outside|root|truncated/i)
  })
  it('parses timestamped unified diff headers', () => {
    const patch = [
      '--- a/src/a.ts\t2026-01-01 10:00:00.000000000 +0000',
      '+++ b/src/a.ts\t2026-01-01 10:05:00.000000000 +0000',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new'
    ].join('\n')
    const targets = parsePatchTargets(patch)
    assert.deepEqual(
      targets.map(t => t.kind + ':' + t.destination),
      ['update:src/a.ts']
    )
  })
  it('parses quoted timestamped diff headers with escapes', () => {
    const patch = [
      '--- "a/my file.ts"\t2026-01-01 10:00:00.000000000 +0000',
      '+++ "b/my file.ts"\t2026-01-01 10:05:00.000000000 +0000',
      '--- "a/weird\\\"name.ts"\t2026-01-01 10:00:00.000000000 +0000',
      '+++ "b/weird\\\"name.ts"\t2026-01-01 10:05:00.000000000 +0000'
    ].join('\n')
    const targets = parsePatchTargets(patch)
    const byPath = new Map(targets.map(t => [t.destination, t]))
    assert.equal(byPath.get('my file.ts')?.kind, 'update')
    assert.equal(byPath.get('weird"name.ts')?.kind, 'update')
  })

  it('allows in-root names that begin with two dots', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    const result = await read.execute('t30a', { filePath: '..config' })
    assert.equal(result.content[0].text, 'ok')
    assert.equal(socket.calls[0].args.filePath, '..config')
  })

  it('rejects traversal beyond the root through two dots', async () => {
    const { rt, socket, emitCatalog } = wireExtension('prefer', FULL_CATALOG)
    emitCatalog()
    const read = rt.registered.find((t: any) => t.name === 'ide_idea_read_file')
    await assert.rejects(() => read.execute('t30b', { filePath: '../x.ts' }), /outside|escape|root/i)
    assert.equal(socket.calls.length, 0)
  })
})

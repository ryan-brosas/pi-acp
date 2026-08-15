import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AcpMcpBridge } from '../../src/acp/mcp-bridge.js'
import { McpIpcServer } from '../../src/acp/mcp-ipc.js'
import { BRIDGE_IPC_VERSION } from '../../src/acp/mcp-types.js'
import { createConnection, createServer } from 'node:net'
import { createInterface } from 'node:readline'
import { createFakeSseServer } from './helpers/fake-sse-server.js'

/** Records extMethod traffic and answers with canned MCP responses. */
class FakeConn {
  calls: Array<{ method: string; params: any }> = []
  notifications: Array<{ method: string; params: any }> = []
  failConnect = false
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> = [
    {
      name: 'open_file_in_editor',
      description: 'Open a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
    }
  ]

  page = 0
  delayCalls = false

  async extMethod(method: string, params: any): Promise<any> {
    this.calls.push({ method, params })
    if (method === 'mcp/connect') {
      if (this.failConnect) throw new Error('mcp/connect failed')
      return { connectionId: `conn-${params.acpId}` }
    }
    if (method === 'mcp/message') {
      if (params.method === 'tools/list') {
        if (params.params?.cursor === 'page-2') return { tools: [{ ...this.tools[0], name: 'second_tool' }] }
        if (params.params?.cursor === 'page-1') return { tools: [this.tools[0]], nextCursor: 'page-2' }
        return { tools: this.tools, ...(this.page > 0 ? { nextCursor: 'page-1' } : {}) }
      }
      if (params.method === 'tools/call') {
        if (this.delayCalls) await new Promise(resolve => setTimeout(resolve, 60))
        return { content: [{ type: 'text', text: 'opened' }] }
      }
      if (params.method === 'initialize') return { protocolVersion: '2025-03-26' }
      return {}
    }
    if (method === 'mcp/disconnect') return {}
    throw new Error(`unexpected extMethod: ${method}`)
  }

  async extNotification(method: string, params: any): Promise<void> {
    this.notifications.push({ method, params })
    this.calls.push({ method, params })
  }
}

function acpServer(id: string, name: string): any {
  return { type: 'acp', id, name }
}

const STDIO_MCP_SERVER_SCRIPT = [
  "import readline from 'node:readline'",
  "const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\\n')",
  'const rl = readline.createInterface({ input: process.stdin })',
  "rl.on('line', line => {",
  '  let message',
  '  try { message = JSON.parse(line) } catch { return }',
  "  if (message.method === 'initialize') send({ id: message.id, result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'fake', version: '1' } } })",
  "  if (message.method === 'tools/list') send({ id: message.id, result: { tools: [{ name: 'open_file_in_editor', description: 'Open a file', inputSchema: { type: 'object' } }] } })",
  "  if (message.method === 'tools/call') send({ id: message.id, result: { content: [{ type: 'text', text: process.env.TEST_MCP_ENV ?? 'missing' }] } })",
  '})'
].join('\n')

function stdioServer(name = 'IntelliJ'): any {
  return {
    name,
    command: process.execPath,
    args: ['--input-type=module', '-e', STDIO_MCP_SERVER_SCRIPT],
    env: [{ name: 'TEST_MCP_ENV', value: 'stdio-ok' }]
  }
}

describe('stdio diagnostics', () => {
  it('reports a bounded exit status and redacts credential-like stderr', async () => {
    const bridge = new AcpMcpBridge(
      new FakeConn() as any,
      [
        {
          name: 'IntelliJ',
          command: process.execPath,
          args: [
            '--input-type=module',
            '-e',
            "process.stderr.write('Authorization: Bearer secret-value\\n'); process.exit(7)"
          ],
          env: []
        }
      ],
      'stdio-exit'
    )

    await bridge.start()

    assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('code=7')))
    assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('[redacted]')))
    assert.ok(bridge.diagnostics.every(diagnostic => !diagnostic.includes('secret-value')))
    await bridge.dispose()
  })
})

describe('AcpMcpBridge', () => {
  it('launches stdio servers, discovers tools, and routes calls', async () => {
    const bridge = new AcpMcpBridge(new FakeConn() as any, [stdioServer()], 'stdio-session')
    const settings = await bridge.start()

    assert.equal(bridge.hasServers, true)
    assert.equal(bridge.lifecycle, 'ready')
    assert.equal(bridge.tools.length, 1)
    assert.equal(bridge.tools[0].exposedName, 'ide_intellij_open_file_in_editor')

    const sock = createConnection(settings.env.PI_ACP_MCP_IPC_ENDPOINT)
    const lines = createInterface({ input: sock })
    const iterator = lines[Symbol.asyncIterator]()
    const nextMessage = async (): Promise<any> => {
      const next = await iterator.next()
      if (next.done) throw new Error('IPC socket closed before the expected message')
      return JSON.parse(next.value)
    }
    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(
      JSON.stringify({
        type: 'hello',
        version: BRIDGE_IPC_VERSION,
        token: settings.env.PI_ACP_MCP_IPC_TOKEN,
        sessionId: settings.env.PI_ACP_MCP_SESSION_ID
      }) + '\n'
    )
    const helloAck = await nextMessage()
    assert.equal(helloAck.type, 'hello_ack')
    assert.equal(helloAck.catalog.projectPath, process.cwd())
    const registration = {
      type: 'catalog_registered',
      registration: {
        catalogId: helloAck.catalog.catalogId,
        registered: bridge.tools.map(tool => ({ exposedName: tool.exposedName, schemaHash: tool.schemaHash })),
        failed: []
      }
    }
    const registrationPromise = bridge.waitForRegistration(1_000)
    sock.write(JSON.stringify(registration) + '\n')
    const acknowledged = await registrationPromise
    assert.equal(acknowledged.registered.length, 1)
    assert.equal(bridge.status.discovered, 1)
    assert.equal(bridge.status.registered, 1)
    assert.equal(bridge.status.failed, 0)
    sock.write(
      JSON.stringify({
        type: 'call',
        id: 'stdio-call',
        tool: 'ide_intellij_open_file_in_editor',
        args: {}
      }) + '\n'
    )
    assert.deepEqual(await nextMessage(), {
      type: 'result',
      id: 'stdio-call',
      result: { content: [{ type: 'text', text: 'stdio-ok' }] }
    })

    lines.close()
    sock.destroy()
    await bridge.dispose()
  })

  it('discovers product-specific capability subsets without requiring a fixed JetBrains IDE catalog', async () => {
    const profiles = [
      { name: 'IntelliJ IDEA', slug: 'intellij_idea', tools: ['search_symbol', 'get_file_problems', 'build_project'] },
      { name: 'WebStorm', slug: 'webstorm', tools: ['search_symbol', 'lint_files', 'reformat_file'] },
      { name: 'PyCharm', slug: 'pycharm', tools: ['search_symbol', 'get_file_problems', 'execute_run_configuration'] },
      { name: 'Rider', slug: 'rider', tools: ['search_symbol', 'get_symbol_info', 'build_project'] }
    ]

    for (const profile of profiles) {
      const conn = new FakeConn()
      conn.tools = profile.tools.map(name => ({
        name,
        description: name,
        inputSchema: { type: 'object', properties: {} }
      }))
      const bridge = new AcpMcpBridge(
        conn as any,
        [acpServer(`srv-${profile.slug}`, profile.name)],
        `profile-${profile.slug}`
      )

      await bridge.start()

      assert.deepEqual(
        bridge.tools.map(tool => tool.remoteName),
        profile.tools
      )
      assert.deepEqual(
        bridge.tools.map(tool => tool.exposedName),
        profile.tools.map(tool => `ide_${profile.slug}_${tool}`)
      )
      assert.equal(bridge.status.discovered, profile.tools.length)
      await bridge.dispose()
    }
  })

  it('discovers bounded cursor pages and computes catalog identity', async () => {
    const conn = new FakeConn()
    conn.page = 1
    const bridge = new AcpMcpBridge(conn as any, [acpServer('srv-1', 'IntelliJ')], 'paged')
    await bridge.start()
    assert.equal(bridge.tools.length, 2)
    assert.ok(bridge.tools.every(tool => tool.schemaHash))
    assert.ok(conn.calls.some(call => call.params?.params?.cursor === 'page-1'))
    assert.ok(conn.calls.some(call => call.params?.params?.cursor === 'page-2'))
    await bridge.dispose()
  })

  it('stops on a repeated pagination cursor and marks the catalog incomplete', async () => {
    const conn = new FakeConn()
    const original = conn.extMethod.bind(conn)
    conn.extMethod = async (method: string, params: any) => {
      if (method === 'mcp/message' && params.method === 'tools/list') {
        return { tools: [], nextCursor: params.params?.cursor ?? 'loop' }
      }
      return original(method, params)
    }
    const bridge = new AcpMcpBridge(conn as any, [acpServer('srv-1', 'IntelliJ')], 'cursor-cycle')
    await bridge.start()
    assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('repeated tools/list cursor')))
    await bridge.dispose()
  })

  it('uses a separate runtime timeout for slow calls', async () => {
    const conn = new FakeConn()
    conn.delayCalls = true
    const bridge = new AcpMcpBridge(conn as any, [acpServer('srv-1', 'IntelliJ')], 'runtime', {
      discoveryTimeoutMs: 100,
      runtimeTimeoutMs: 200
    })
    const settings = await bridge.start()
    const sock = createConnection(settings.env.PI_ACP_MCP_IPC_ENDPOINT)
    const lines = createInterface({ input: sock })
    const iterator = lines[Symbol.asyncIterator]()
    const nextMessage = async (): Promise<any> => {
      const next = await iterator.next()
      if (next.done) throw new Error('IPC socket closed before the expected message')
      return JSON.parse(next.value)
    }
    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(
      JSON.stringify({
        type: 'hello',
        version: BRIDGE_IPC_VERSION,
        token: settings.env.PI_ACP_MCP_IPC_TOKEN,
        sessionId: settings.env.PI_ACP_MCP_SESSION_ID
      }) + '\n'
    )
    const helloAck = await nextMessage()
    assert.equal(helloAck.type, 'hello_ack')
    sock.write(
      JSON.stringify({
        type: 'catalog_registered',
        registration: {
          catalogId: helloAck.catalog.catalogId,
          registered: bridge.tools.map(tool => ({ exposedName: tool.exposedName, schemaHash: tool.schemaHash })),
          failed: []
        }
      }) + '\n'
    )
    sock.write(
      JSON.stringify({ type: 'call', id: 'slow-ok', tool: 'ide_intellij_open_file_in_editor', args: {} }) + '\n'
    )
    assert.equal((await nextMessage()).type, 'result')
    lines.close()
    sock.destroy()
    await bridge.dispose()
  })

  it('cancels an ACP call when the runtime deadline expires', async () => {
    const conn = new FakeConn()
    conn.delayCalls = true
    const bridge = new AcpMcpBridge(conn as any, [acpServer('srv-1', 'IntelliJ')], 'runtime-timeout', {
      discoveryTimeoutMs: 100,
      runtimeTimeoutMs: 20
    })
    const settings = await bridge.start()
    const sock = createConnection(settings.env.PI_ACP_MCP_IPC_ENDPOINT)
    const lines = createInterface({ input: sock })
    const iterator = lines[Symbol.asyncIterator]()
    const nextMessage = async (): Promise<any> => {
      const next = await iterator.next()
      if (next.done) throw new Error('IPC socket closed before the expected message')
      return JSON.parse(next.value)
    }
    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(
      JSON.stringify({
        type: 'hello',
        version: BRIDGE_IPC_VERSION,
        token: settings.env.PI_ACP_MCP_IPC_TOKEN,
        sessionId: settings.env.PI_ACP_MCP_SESSION_ID
      }) + '\n'
    )
    assert.equal((await nextMessage()).type, 'hello_ack')
    sock.write(
      JSON.stringify({ type: 'call', id: 'timeout-call', tool: 'ide_intellij_open_file_in_editor', args: {} }) + '\n'
    )
    assert.deepEqual(await nextMessage(), {
      type: 'error',
      id: 'timeout-call',
      code: 'cancelled',
      message: 'IDE tool call runtime timeout'
    })
    assert.ok(conn.notifications.some(call => call.params?.method === 'notifications/cancelled'))
    lines.close()
    sock.destroy()
    await bridge.dispose()
  })

  it('connects ACP servers, initializes MCP, discovers tools, and returns spawn settings', async () => {
    const conn = new FakeConn()
    const bridge = new AcpMcpBridge(conn as any, [acpServer('srv-1', 'IntelliJ')], 'session-1')
    const settings = await bridge.start()

    assert.equal(bridge.hasServers, true)
    assert.equal(bridge.lifecycle, 'ready')
    const methods = conn.calls.map(c => c.method)
    assert.ok(methods.includes('mcp/connect'))
    assert.equal(conn.calls.find(c => c.method === 'mcp/message')?.params.method, 'initialize')
    assert.ok(conn.calls.some(c => c.method === 'mcp/message' && c.params.method === 'tools/list'))
    assert.deepEqual(conn.notifications[0], {
      method: 'mcp/message',
      params: { connectionId: 'conn-srv-1', method: 'notifications/initialized', params: {} }
    })
    assert.equal(settings.extensionPaths.length, 1)
    assert.ok(settings.env.PI_ACP_MCP_IPC_ENDPOINT)
    assert.ok(settings.env.PI_ACP_MCP_IPC_TOKEN)
    assert.equal(settings.env.PI_ACP_MCP_SESSION_ID, 'session-1')

    const tools = bridge.tools
    assert.equal(tools.length, 1)
    assert.equal(tools[0].exposedName, 'ide_intellij_open_file_in_editor')
    assert.equal(tools[0].remoteName, 'open_file_in_editor')
    await bridge.dispose()
    assert.equal(bridge.lifecycle, 'closed')
    await assert.rejects(() => bridge.start(), /already closed/)
  })

  it('reports malformed command-shaped descriptors instead of silently ignoring them', async () => {
    const bridge = new AcpMcpBridge(
      new FakeConn() as any,
      [{ name: 'Broken', command: process.execPath, args: 'not-an-array', env: [] } as any],
      'malformed-descriptor'
    )

    const settings = await bridge.start()
    assert.equal(bridge.hasServers, true)
    assert.equal(settings.extensionPaths.length, 1)
    assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('invalid stdio descriptor')))
    assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('phase=descriptor_validation')))
    assert.ok(bridge.diagnostics.every(diagnostic => !diagnostic.includes('not-an-array')))
    await bridge.dispose()
  })

  it('reports registration failures separately from discovered tools', async () => {
    const bridge = new AcpMcpBridge(new FakeConn() as any, [stdioServer()], 'partial-registration')
    const settings = await bridge.start()
    const sock = createConnection(settings.env.PI_ACP_MCP_IPC_ENDPOINT)
    const lines = createInterface({ input: sock })
    const iterator = lines[Symbol.asyncIterator]()
    const nextMessage = async (): Promise<any> => {
      const next = await iterator.next()
      if (next.done) throw new Error('IPC socket closed before the expected message')
      return JSON.parse(next.value)
    }
    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(
      JSON.stringify({
        type: 'hello',
        version: BRIDGE_IPC_VERSION,
        token: settings.env.PI_ACP_MCP_IPC_TOKEN,
        sessionId: settings.env.PI_ACP_MCP_SESSION_ID
      }) + '\n'
    )
    const helloAck = await nextMessage()
    const registrationPromise = bridge.waitForRegistration(1_000)
    sock.write(
      JSON.stringify({
        type: 'catalog_registered',
        registration: {
          catalogId: helloAck.catalog.catalogId,
          registered: [],
          failed: [
            {
              exposedName: bridge.tools[0].exposedName,
              schemaHash: bridge.tools[0].schemaHash,
              message: 'fake registration failure'
            }
          ]
        }
      }) + '\n'
    )
    await registrationPromise
    assert.equal(bridge.status.discovered, 1)
    assert.equal(bridge.status.registered, 0)
    assert.equal(bridge.status.failed, 1)
    lines.close()
    sock.destroy()
    await bridge.dispose()
  })

  it('records unsupported inbound ACP MCP messages without changing the catalog', async () => {
    const bridge = new AcpMcpBridge(new FakeConn() as any, [acpServer('srv-1', 'IntelliJ')], 'inbound')
    await bridge.start()
    assert.deepEqual(
      await bridge.handleIncomingMcpMessage(
        { connectionId: 'conn-srv-1', method: 'sampling/createMessage', params: {} },
        false
      ),
      { error: { code: -32601, message: 'Unsupported server-originated MCP request: sampling/createMessage' } }
    )
    await bridge.handleIncomingMcpMessage(
      { connectionId: 'conn-srv-1', method: 'notifications/tools/list_changed', params: {} },
      true
    )
    assert.equal(bridge.tools.length, 1)
    assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('session snapshot')))
    await bridge.dispose()
  })
  it('dedupes tools/list_changed diagnostics across both notification paths (F-023)', async () => {
    const conn = new FakeConn()
    const bridge = new AcpMcpBridge(conn as any, [acpServer('srv-1', 'IntelliJ')], 'dedupe-list-changed')
    await bridge.start()
    // The same event arriving twice (or from a different path) must produce one diagnostic.
    await bridge.handleIncomingMcpMessage(
      { connectionId: 'conn-srv-1', method: 'notifications/tools/list_changed', params: {} },
      true
    )
    await bridge.handleIncomingMcpMessage(
      { connectionId: 'conn-srv-1', method: 'notifications/tools/list_changed', params: {} },
      true
    )
    const listChanged = bridge.diagnostics.filter(d => d.includes('tools/list_changed'))
    assert.equal(listChanged.length, 1)
    assert.ok(listChanged[0].includes('session snapshot'))
    await bridge.dispose()
  })

  it('routes authenticated IPC calls to the remote MCP tool', async () => {
    const conn = new FakeConn()
    const bridge = new AcpMcpBridge(conn as any, [acpServer('srv-1', 'IntelliJ')], 'call-session')
    const settings = await bridge.start()
    const sock = createConnection(settings.env.PI_ACP_MCP_IPC_ENDPOINT)
    const lines = createInterface({ input: sock })
    const iterator = lines[Symbol.asyncIterator]()
    const nextMessage = async (): Promise<any> => {
      const next = await iterator.next()
      if (next.done) throw new Error('IPC socket closed before the expected message')
      return JSON.parse(next.value)
    }

    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(
      JSON.stringify({
        type: 'hello',
        version: BRIDGE_IPC_VERSION,
        token: settings.env.PI_ACP_MCP_IPC_TOKEN,
        sessionId: settings.env.PI_ACP_MCP_SESSION_ID
      }) + '\n'
    )
    const helloAck = await nextMessage()
    assert.equal(helloAck.type, 'hello_ack')
    sock.write(
      JSON.stringify({
        type: 'catalog_registered',
        registration: {
          catalogId: helloAck.catalog.catalogId,
          registered: bridge.tools.map(tool => ({ exposedName: tool.exposedName, schemaHash: tool.schemaHash })),
          failed: []
        }
      }) + '\n'
    )

    sock.write(
      JSON.stringify({ type: 'call', id: 'call-1', tool: 'ide_intellij_open_file_in_editor', args: { path: 'x.ts' } }) +
        '\n'
    )
    const result = await nextMessage()
    assert.deepEqual(result, { type: 'result', id: 'call-1', result: { content: [{ type: 'text', text: 'opened' }] } })
    assert.deepEqual(conn.calls.at(-1), {
      method: 'mcp/message',
      params: {
        connectionId: 'conn-srv-1',
        method: 'tools/call',
        params: { name: 'open_file_in_editor', arguments: { path: 'x.ts' } }
      }
    })

    lines.close()
    sock.destroy()
    await bridge.dispose()
  })

  it('omits failed servers but keeps successful ones', async () => {
    const conn = new FakeConn()
    conn.failConnect = true
    const bridge = new AcpMcpBridge(conn as any, [acpServer('bad', 'Broken'), acpServer('good', 'IntelliJ')], 's')
    // First server fails; second succeeds. failConnect is global, so make it selective:
    const original = conn.extMethod.bind(conn)
    conn.failConnect = false
    let first = true
    conn.extMethod = async (method: string, params: any) => {
      if (method === 'mcp/connect' && first) {
        first = false
        throw new Error('mcp/connect failed')
      }
      return original(method, params)
    }
    const settings = await bridge.start()
    assert.equal(bridge.tools.length, 1)
    assert.equal(bridge.diagnostics.length, 1)
    assert.ok(bridge.diagnostics[0].includes('Broken'))
    assert.equal(settings.extensionPaths.length, 1)
    await bridge.dispose()
  })

  it('disposes idempotently and disconnects each server exactly once', async () => {
    const conn = new FakeConn()
    const bridge = new AcpMcpBridge(conn as any, [acpServer('a', 'A'), acpServer('b', 'B')], 's')
    await bridge.start()
    await bridge.dispose()
    await bridge.dispose()
    const disconnects = conn.calls.filter(c => c.method === 'mcp/disconnect')
    assert.equal(disconnects.length, 2)
  })

  it('does not hang on a silent client: discovery times out and reports diagnostics', async () => {
    const conn = new FakeConn()
    conn.extMethod = async () => new Promise(() => {}) // never resolves
    const bridge = new AcpMcpBridge(conn as any, [acpServer('quiet', 'Quiet')], 's', 200)
    const t0 = Date.now()
    await bridge.start()
    const elapsed = Date.now() - t0
    assert.ok(elapsed < 5000, `start() took ${elapsed}ms — should have timed out`)
    assert.equal(bridge.tools.length, 0)
    assert.ok(bridge.diagnostics.length > 0)
    assert.ok(bridge.diagnostics[0].includes('Quiet'))
    await bridge.dispose()
  })

  it('rejects a second start without replacing the active IPC server', async () => {
    const bridge = new AcpMcpBridge(new FakeConn() as any, [acpServer('srv', 'IntelliJ')], 's')
    await bridge.start()
    await assert.rejects(() => bridge.start(), /already started/)
    await bridge.dispose()
  })

  it('returns empty spawn settings when no ACP servers are provided', async () => {
    const conn = new FakeConn()
    const bridge = new AcpMcpBridge(conn as any, [], 's')
    const settings = await bridge.start()
    assert.deepEqual(settings.extensionPaths, [])
    assert.equal(bridge.hasServers, false)
  })
})

describe('McpIpcServer handshake', () => {
  it('authenticates with correct token and delivers the catalog', async () => {
    const server = await McpIpcServer.start('ipc-test')
    const ep = server.endpoint()
    server.setCatalog({
      catalogId: 'catalog-1',
      tools: [{ exposedName: 'ide_x_y', connectionId: 'c', remoteName: 'y', inputSchema: {} }]
    })
    const handshake = server.waitForHandshake()
    const registration = server.waitForRegistration(1000)

    const sock = createConnection(ep.endpoint)
    const received: any[] = []
    sock.setEncoding('utf8')
    let buf = ''
    sock.on('data', (d: Buffer) => {
      buf += d.toString()
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        received.push(JSON.parse(buf.slice(0, i)))
        buf = buf.slice(i + 1)
      }
    })
    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(
      JSON.stringify({ type: 'hello', version: BRIDGE_IPC_VERSION, token: ep.token, sessionId: ep.sessionId }) + '\n'
    )
    const catalog = await handshake
    await new Promise<void>(resolve => setTimeout(resolve, 100))
    assert.equal(catalog.tools.length, 1)
    assert.ok(received.some((m: any) => m.type === 'hello_ack'))
    sock.write(
      JSON.stringify({
        type: 'catalog_registered',
        registration: { catalogId: 'catalog-1', registered: [{ exposedName: 'ide_x_y' }], failed: [] }
      }) + '\n'
    )
    assert.deepEqual(await registration, {
      catalogId: 'catalog-1',
      registered: [{ exposedName: 'ide_x_y' }],
      failed: []
    })
    sock.destroy()
    server.close()
  })

  it('rejects a registration acknowledgement that omits catalog tools', async () => {
    const server = await McpIpcServer.start('ipc-bad-registration')
    const ep = server.endpoint()
    server.setCatalog({
      catalogId: 'catalog-bad',
      tools: [{ exposedName: 'ide_x_y', connectionId: 'c', remoteName: 'y', inputSchema: {}, schemaHash: 'hash-1' }]
    })
    const registration = server.waitForRegistration(1000)
    const sock = createConnection(ep.endpoint)
    let buffer = ''
    let resolveHello: ((message: any) => void) | undefined
    const hello = new Promise<any>(resolve => {
      resolveHello = resolve
    })
    sock.setEncoding('utf8')
    sock.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      let index: number
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (line) resolveHello?.(JSON.parse(line))
      }
    })
    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(
      JSON.stringify({ type: 'hello', version: BRIDGE_IPC_VERSION, token: ep.token, sessionId: ep.sessionId }) + '\n'
    )
    assert.equal((await hello).type, 'hello_ack')
    sock.write(
      JSON.stringify({
        type: 'catalog_registered',
        registration: { catalogId: 'catalog-bad', registered: [], failed: [] }
      }) + '\n'
    )
    await assert.rejects(registration, /omitted tools/)
    sock.destroy()
    server.close()
  })

  it('returns a completed handshake to late waiters', async () => {
    const server = await McpIpcServer.start('ipc-late-waiter')
    const ep = server.endpoint()
    const sock = createConnection(ep.endpoint)
    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(
      JSON.stringify({ type: 'hello', version: BRIDGE_IPC_VERSION, token: ep.token, sessionId: ep.sessionId }) + '\n'
    )
    await new Promise(resolve => setTimeout(resolve, 50))

    const catalog = await server.waitForHandshake()
    assert.deepEqual(catalog, { tools: [] })
    sock.destroy()
    server.close()
  })

  it('rejects wrong tokens', async () => {
    const server = await McpIpcServer.start('ipc-test2')
    const ep = server.endpoint()
    const sock = createConnection(ep.endpoint)
    const received: any[] = []
    sock.setEncoding('utf8')
    let buf = ''
    sock.on('data', (d: Buffer) => {
      buf += d.toString()
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        received.push(JSON.parse(buf.slice(0, i)))
        buf = buf.slice(i + 1)
      }
    })
    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(
      JSON.stringify({ type: 'hello', version: BRIDGE_IPC_VERSION, token: 'wrong', sessionId: ep.sessionId }) + '\n'
    )
    await new Promise<void>(resolve => setTimeout(resolve, 100))
    assert.ok(received.some((m: any) => m.type === 'error' && m.code === 'unauthorized'))
    sock.destroy()
    server.close()
  })

  it('rejects messages before authentication', async () => {
    const server = await McpIpcServer.start('ipc-test3')
    const ep = server.endpoint()
    const sock = createConnection(ep.endpoint)
    const received: any[] = []
    sock.setEncoding('utf8')
    let buf = ''
    sock.on('data', (d: Buffer) => {
      buf += d.toString()
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        received.push(JSON.parse(buf.slice(0, i)))
        buf = buf.slice(i + 1)
      }
    })
    await new Promise<void>(resolve => sock.on('connect', () => resolve()))
    sock.write(JSON.stringify({ type: 'call', id: '1', tool: 'ide_x', args: {} }) + '\n')
    await new Promise<void>(resolve => setTimeout(resolve, 100))
    assert.ok(received.some((m: any) => m.type === 'error' && m.code === 'unauthorized'))
    sock.destroy()
    server.close()
  })

  it('prefers SSE when the descriptor advertises IJ_MCP_SERVER_PORT, never spawning stdio', async () => {
    const fake = await createFakeSseServer({ authToken: 'fallback-token' })
    let bridge: AcpMcpBridge | undefined
    try {
      bridge = new AcpMcpBridge(
        new FakeConn() as any,
        [
          {
            name: 'idea',
            command: process.execPath,
            args: ['--input-type=module', '-e', 'process.exit(0)'],
            env: [
              { name: 'IJ_MCP_SERVER_PORT', value: String(fake.port) },
              { name: 'IJ_MCP_AUTH_TOKEN', value: 'fallback-token' }
            ]
          }
        ],
        'sse-fallback-session'
      )
      const settings = await bridge.start()

      assert.equal(bridge.lifecycle, 'ready')
      assert.equal(bridge.tools.length, 1)
      assert.equal(bridge.tools[0].exposedName, 'ide_idea_open_file_in_editor')
      assert.ok(bridge.tools[0].connectionId.startsWith('sse-'))
      assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('connected over SSE (transport=sse')))
      assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('auth=token')))
      assert.ok(fake.requests.length > 0)
      assert.ok(
        fake.requests.every(
          request =>
            request.headers['ij_mcp_auth_token'] === 'fallback-token' &&
            request.headers.authorization === 'Bearer fallback-token'
        )
      )

      const sock = createConnection(settings.env.PI_ACP_MCP_IPC_ENDPOINT)
      const lines = createInterface({ input: sock })
      const iterator = lines[Symbol.asyncIterator]()
      const nextMessage = async (): Promise<any> => {
        const next = await iterator.next()
        if (next.done) throw new Error('IPC socket closed before the expected message')
        return JSON.parse(next.value)
      }
      await new Promise<void>(resolve => sock.on('connect', () => resolve()))
      sock.write(
        JSON.stringify({
          type: 'hello',
          version: BRIDGE_IPC_VERSION,
          token: settings.env.PI_ACP_MCP_IPC_TOKEN,
          sessionId: settings.env.PI_ACP_MCP_SESSION_ID
        }) + '\n'
      )
      const ack = await nextMessage()
      assert.equal(ack.type, 'hello_ack')

      const registrationPromise = bridge.waitForRegistration(1_000)
      sock.write(
        JSON.stringify({
          type: 'catalog_registered',
          registration: {
            catalogId: ack.catalog.catalogId,
            registered: bridge.tools.map(tool => ({ exposedName: tool.exposedName, schemaHash: tool.schemaHash })),
            failed: []
          }
        }) + '\n'
      )
      const registration = await registrationPromise
      assert.equal(registration.registered.length, 1)

      sock.write(JSON.stringify({ type: 'call', id: '1', tool: bridge.tools[0].exposedName, args: {} }) + '\n')
      const result = await nextMessage()
      assert.equal(result.type, 'result')
      assert.deepEqual(result.result, { content: [{ type: 'text', text: 'sse-ok' }] })

      lines.close()
      sock.destroy()
    } finally {
      await bridge?.dispose()
      await fake.close()
    }
  })

  it('notes a missing IJ_MCP_AUTH_TOKEN when the descriptor advertises an SSE port', async () => {
    const fake = await createFakeSseServer()
    let bridge: AcpMcpBridge | undefined
    try {
      bridge = new AcpMcpBridge(
        new FakeConn() as any,
        [
          {
            name: 'idea',
            command: process.execPath,
            args: ['--input-type=module', '-e', 'process.exit(0)'],
            env: [{ name: 'IJ_MCP_SERVER_PORT', value: String(fake.port) }]
          }
        ],
        'sse-no-token-session'
      )
      await bridge.start()
      assert.equal(bridge.tools.length, 1)
      assert.ok(
        bridge.diagnostics.some(diagnostic => diagnostic.includes('IJ_MCP_SERVER_PORT without IJ_MCP_AUTH_TOKEN'))
      )
      assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('auth=none')))
    } finally {
      await bridge?.dispose()
      await fake.close()
    }
  })

  it('reports SSE as unavailable when the IDE rejects the token', async () => {
    const fake = await createFakeSseServer({ authToken: 'expected-token' })
    let bridge: AcpMcpBridge | undefined
    try {
      bridge = new AcpMcpBridge(
        new FakeConn() as any,
        [
          {
            name: 'idea',
            command: process.execPath,
            args: ['--input-type=module', '-e', 'process.exit(0)'],
            env: [
              { name: 'IJ_MCP_SERVER_PORT', value: String(fake.port) },
              { name: 'IJ_MCP_AUTH_TOKEN', value: 'wrong-token' }
            ]
          }
        ],
        'sse-rejected-session'
      )
      await bridge.start()
      assert.equal(bridge.tools.length, 0)
      assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('SSE unavailable')))
      assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('HTTP 401')))
    } finally {
      await bridge?.dispose()
      await fake.close()
    }
  })

  it('falls back to stdio when the advertised SSE endpoint is unreachable', async () => {
    const deadPort = await new Promise<number>(resolve => {
      const probe = createServer()
      probe.listen(0, '127.0.0.1', () => {
        const port = (probe.address() as { port: number }).port
        probe.close(() => resolve(port))
      })
    })
    const server = stdioServer('IntelliJ')
    const bridge = new AcpMcpBridge(
      new FakeConn() as any,
      [{ ...server, env: [{ name: 'IJ_MCP_SERVER_PORT', value: String(deadPort) }] }],
      'sse-dead-port-session'
    )
    try {
      await bridge.start()
      assert.equal(bridge.lifecycle, 'ready')
      assert.ok(bridge.tools.length >= 1)
      assert.ok(bridge.tools[0].connectionId.startsWith('stdio-'))
      assert.ok(bridge.diagnostics.some(diagnostic => diagnostic.includes('SSE unavailable')))
      assert.ok(!bridge.diagnostics.some(diagnostic => diagnostic.includes('unavailable (transport=stdio')))
    } finally {
      await bridge.dispose()
    }
  })

  it('records IDE-applied mutation paths reported by the pi extension', async () => {
    const bridge = new AcpMcpBridge(new FakeConn() as any, [stdioServer()], 'ledger-session')
    const settings = await bridge.start()
    try {
      assert.deepEqual(bridge.appliedMutationPaths, [])
      const sock = createConnection(settings.env.PI_ACP_MCP_IPC_ENDPOINT)
      const lines = createInterface({ input: sock })
      const iterator = lines[Symbol.asyncIterator]()
      const nextMessage = async (): Promise<any> => {
        const next = await iterator.next()
        if (next.done) throw new Error('IPC socket closed before the expected message')
        return JSON.parse(next.value)
      }
      await new Promise<void>(resolve => sock.on('connect', () => resolve()))
      sock.write(
        JSON.stringify({
          type: 'hello',
          version: BRIDGE_IPC_VERSION,
          token: settings.env.PI_ACP_MCP_IPC_TOKEN,
          sessionId: 'ledger-session'
        }) + '\n'
      )
      assert.equal((await nextMessage()).type, 'hello_ack')
      sock.write(JSON.stringify({ type: 'mutations_applied', paths: ['src/a.ts', 'src/b.ts'] }) + '\n')
      const deadline = Date.now() + 5_000
      while (bridge.appliedMutationPaths.length < 2 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      assert.deepEqual(bridge.appliedMutationPaths, ['src/a.ts', 'src/b.ts'])
      lines.close()
      sock.destroy()
    } finally {
      await bridge.dispose()
    }
  })

  it('keeps bridge diagnostics scoped to the bridge instance', async () => {
    const failing = new AcpMcpBridge(
      new FakeConn() as any,
      [
        {
          name: 'Broken',
          command: process.execPath,
          args: ['--input-type=module', '-e', "process.stderr.write('boom'); process.exit(7)"],
          env: []
        }
      ],
      'scoped-failing-session'
    )
    await failing.start()
    assert.ok(failing.diagnostics.some(diagnostic => diagnostic.includes('code=7')))

    const healthy = new AcpMcpBridge(new FakeConn() as any, [], 'scoped-healthy-session')
    await healthy.start()
    assert.deepEqual(healthy.diagnostics, [])

    await failing.dispose()
    await healthy.dispose()
  })
})

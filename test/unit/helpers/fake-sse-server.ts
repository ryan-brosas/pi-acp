import { createServer, type Server, type ServerResponse } from 'node:http'

/**
 * Minimal fake of IntelliJ's in-process MCP server over HTTP+SSE:
 * GET /sse streams heartbeats + the `endpoint` event; POST to that endpoint
 * receives JSON-RPC. Responses are pushed over the SSE stream (MCP's async
 * pattern) unless `respondInPostBody` is set.
 */
export type FakeSseTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }

export type FakeSseOptions = {
  tools?: FakeSseTool[]
  respondInPostBody?: boolean
  callResult?: unknown
  endpointDelayMs?: number
  dropEndpointEvent?: boolean
  neverRespondCalls?: boolean
  crlf?: boolean
  authToken?: string
}

export type FakeSseServer = {
  port: number
  baseUrl: string
  requests: Array<{
    method: string
    body: unknown
    path: string
    headers: Record<string, string | string[] | undefined>
  }>
  sseConnections: ServerResponse[]
  close(): Promise<void>
}

export function createFakeSseServer(options: FakeSseOptions = {}): Promise<FakeSseServer> {
  const tools = options.tools ?? [
    { name: 'open_file_in_editor', description: 'Open a file', inputSchema: { type: 'object' } }
  ]
  const callResult = options.callResult ?? { content: [{ type: 'text', text: 'sse-ok' }] }
  const state: FakeSseServer = {
    port: 0,
    baseUrl: '',
    requests: [],
    sseConnections: [],
    close: async () => undefined
  }

  const eol = options.crlf ? '\r\n' : '\n'
  const respond = (message: unknown) => {
    for (const response of state.sseConnections) {
      response.write(`event: message${eol}data: ${JSON.stringify(message)}${eol}${eol}`)
    }
  }

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    state.requests.push({
      method: request.method ?? '',
      body: undefined,
      path: url.pathname + url.search,
      headers: request.headers
    })
    if (options.authToken) {
      const authorized =
        request.headers['ij_mcp_auth_token'] === options.authToken &&
        request.headers.authorization === `Bearer ${options.authToken}`
      if (!authorized) {
        response
          .writeHead(401, { 'content-type': 'text/plain' })
          .end('MCP server is running in restricted mode. Please, provide valid authorization token')
        return
      }
    }

    if (request.method === 'GET' && url.pathname === '/sse') {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive'
      })
      response.write(`: heartbeat${eol}${eol}`)
      state.sseConnections.push(response)
      request.on('close', () => {
        const index = state.sseConnections.indexOf(response)
        if (index >= 0) state.sseConnections.splice(index, 1)
      })
      const sendEndpoint = () => {
        if (!options.dropEndpointEvent) {
          response.write(`event: endpoint${eol}data: /message?sessionId=fake-session${eol}${eol}`)
        }
      }
      if (options.endpointDelayMs) setTimeout(sendEndpoint, options.endpointDelayMs)
      else sendEndpoint()
      return
    }

    if (request.method === 'POST' && url.pathname === '/message') {
      let raw = ''
      request.on('data', chunk => {
        raw += String(chunk)
      })
      request.on('end', () => {
        let message: { id?: number | string; method?: string; params?: any }
        try {
          message = JSON.parse(raw)
        } catch {
          response.writeHead(400).end('bad json')
          return
        }
        const last = state.requests[state.requests.length - 1]
        last.body = message

        if (message.method && message.id === undefined) {
          response.writeHead(202).end()
          return
        }

        let result: unknown
        if (message.method === 'initialize')
          result = { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'fake-sse', version: '1' } }
        else if (message.method === 'tools/list') result = { tools }
        else if (message.method === 'tools/call') result = callResult
        else result = {}

        const reply = { jsonrpc: '2.0', id: message.id, result }
        if (options.neverRespondCalls && message.method === 'tools/call') {
          response.writeHead(202).end()
          return
        }
        if (options.respondInPostBody) {
          response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reply))
        } else {
          response.writeHead(202).end()
          respond(reply)
        }
      })
      return
    }

    response.writeHead(404).end()
  })

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('fake SSE server failed to bind')
      state.port = address.port
      state.baseUrl = `http://127.0.0.1:${address.port}`
      state.close = async () => {
        for (const connection of state.sseConnections) connection.end()
        await new Promise<void>(resolveClose => {
          server.close(() => resolveClose())
          setTimeout(resolveClose, 300).unref?.()
        })
        server.closeAllConnections?.()
      }
      resolve(state)
    })
  })
}

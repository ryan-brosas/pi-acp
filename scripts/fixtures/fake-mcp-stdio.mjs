import { appendFileSync } from 'node:fs'

export function startFakeMcpServer({ serverName, timeoutMs, tools, handleToolCall }) {
  const logPath = process.env.FAKE_MCP_LOG ?? ''
  const log = message => {
    if (!logPath) return
    try {
      appendFileSync(logPath, JSON.stringify(message) + '\n')
    } catch {
      // ignore
    }
  }
  const send = message => process.stdout.write(JSON.stringify(message) + '\n')

  process.stdin.setEncoding('utf8')
  setTimeout(() => process.exit(0), timeoutMs)
  process.stdin.on('end', () => process.exit(0))
  process.stdin.on('close', () => process.exit(0))

  const handle = message => {
    log({ type: 'received', method: message.method, id: message.id })
    if (message.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: serverName, version: '1.0.0' }
        }
      })
      return
    }
    if (message.method === 'notifications/initialized') return
    if (message.method === 'tools/list') {
      send({ jsonrpc: '2.0', id: message.id, result: { tools } })
      return
    }
    if (message.method === 'tools/call') {
      const args = message.params?.arguments ?? {}
      log({ type: 'call', name: message.params?.name, args })
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: handleToolCall(message.params?.name, args)
      })
      return
    }
    send({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: `method not found: ${message.method}` }
    })
  }

  let buffer = ''
  process.stdin.on('data', chunk => {
    buffer += chunk
    let boundary
    while ((boundary = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, boundary).trim()
      buffer = buffer.slice(boundary + 1)
      if (!line) continue
      try {
        handle(JSON.parse(line))
      } catch {
        // ignore malformed fixture input
      }
    }
  })
}

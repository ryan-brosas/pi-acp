// Minimal MCP stdio server for smoke-mcp-fixture (F-006/F-021).
// Speaks the MCP JSON-RPC subset the adapter bridge needs: initialize,
// notifications/initialized, tools/list, tools/call. Logs received methods and
// calls to a file the probe asserts on; exits when stdin closes or after 120s.
import { appendFileSync } from 'node:fs'

const logPath = process.env.FAKE_MCP_LOG ?? ''
const log = m => {
  if (logPath) {
    try {
      appendFileSync(logPath, JSON.stringify(m) + '\n')
    } catch {
      // ignore
    }
  }
}

process.stdin.setEncoding('utf8')
let buf = ''
const send = obj => process.stdout.write(JSON.stringify(obj) + '\n')

setTimeout(() => process.exit(0), 120_000)
process.stdin.on('end', () => process.exit(0))
process.stdin.on('close', () => process.exit(0))

function handle(msg) {
  log({ type: 'received', method: msg.method, id: msg.id })
  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'fake-mcp', version: '1.0.0' }
      }
    })
  } else if (msg.method === 'notifications/initialized') {
    // no response
  } else if (msg.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        tools: [
          {
            name: 'echo',
            description: 'Echo the value back',
            inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] }
          }
        ]
      }
    })
  } else if (msg.method === 'tools/call') {
    const args = msg.params?.arguments ?? {}
    log({ type: 'call', name: msg.params?.name, args })
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: { content: [{ type: 'text', text: `echo:${args.value ?? ''}` }], isError: false }
    })
  } else {
    send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } })
  }
}

process.stdin.on('data', chunk => {
  buf += chunk
  let idx
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    handle(msg)
  }
})

// Minimal MCP stdio server for smoke-ide-inspect (F-021/F-030). Exposes
// lint_files and get_file_problems so the adapter's post-turn inspection gate
// can run; lint_files returns one fixed WARNING per file it is asked to lint.
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

setTimeout(() => process.exit(0), 180_000)
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
        serverInfo: { name: 'fake-mcp-inspect', version: '1.0.0' }
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
            name: 'lint_files',
            description: 'Lint files',
            inputSchema: {
              type: 'object',
              properties: { files: { type: 'array' }, min_severity: { type: 'string' } }
            }
          },
          {
            name: 'get_file_problems',
            description: 'File problems',
            inputSchema: {
              type: 'object',
              properties: { filePath: { type: 'string' }, errorsOnly: { type: 'boolean' } }
            }
          },
          {
            name: 'run_inspection_kts',
            description: 'Run an inspection.kts script',
            inputSchema: {
              type: 'object',
              properties: { inspectionKtsCode: { type: 'string' }, contextPath: { type: 'string' } }
            }
          }
        ]
      }
    })
  } else if (msg.method === 'tools/call') {
    const args = msg.params?.arguments ?? {}
    log({ type: 'call', name: msg.params?.name, args })
    let items = []
    if (msg.params?.name === 'lint_files') {
      items = (Array.isArray(args.files) ? args.files : []).map(filePath => ({
        filePath,
        problems: [{ severity: 'WARNING', description: 'Fake warning', line: 1, column: 1 }]
      }))
    } else if (msg.params?.name === 'get_file_problems') {
      items = [
        {
          filePath: args.filePath ?? '',
          problems: [{ severity: 'WARNING', description: 'Fake warning', line: 1, column: 1 }]
        }
      ]
    } else if (msg.params?.name === 'run_inspection_kts') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                compilationSuccess: true,
                inspectionResultMessage: 'Inspection found 1 problems',
                foundProblems: [
                  {
                    message: "Avoid declaring 'any'",
                    lineNumber: 1,
                    highlightType: 'GENERIC_ERROR_OR_WARNING',
                    elementText: 'any'
                  }
                ]
              })
            }
          ],
          isError: false
        }
      })
      return
    }
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: { content: [{ type: 'text', text: JSON.stringify({ items }) }], isError: false }
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

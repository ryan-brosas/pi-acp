// Minimal MCP stdio server for smoke-ide-inspect (F-021/F-030). Exposes
// lint_files and get_file_problems so the adapter's post-turn inspection gate
// can run; lint_files returns one fixed WARNING per file it is asked to lint.
import { startFakeMcpServer } from './fake-mcp-stdio.mjs'

startFakeMcpServer({
  serverName: 'fake-mcp-inspect',
  timeoutMs: 180_000,
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
  ],
  handleToolCall(name, args) {
    let items = []
    if (name === 'lint_files') {
      items = (Array.isArray(args.files) ? args.files : []).map(filePath => ({
        filePath,
        problems: [{ severity: 'WARNING', description: 'Fake warning', line: 1, column: 1 }]
      }))
    } else if (name === 'get_file_problems') {
      items = [
        {
          filePath: args.filePath ?? '',
          problems: [{ severity: 'WARNING', description: 'Fake warning', line: 1, column: 1 }]
        }
      ]
    } else if (name === 'run_inspection_kts') {
      return {
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
    }
    return { content: [{ type: 'text', text: JSON.stringify({ items }) }], isError: false }
  }
})

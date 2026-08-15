// Minimal MCP stdio server for smoke-mcp-fixture (F-006/F-021).
// Speaks the MCP JSON-RPC subset the adapter bridge needs: initialize,
// notifications/initialized, tools/list, tools/call. Logs received methods and
// calls to a file the probe asserts on; exits when stdin closes or after 120s.
import { startFakeMcpServer } from './fake-mcp-stdio.mjs'

startFakeMcpServer({
  serverName: 'fake-mcp',
  timeoutMs: 120_000,
  tools: [
    {
      name: 'echo',
      description: 'Echo the value back',
      inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] }
    }
  ],
  handleToolCall(_name, args) {
    return { content: [{ type: 'text', text: `echo:${args.value ?? ''}` }], isError: false }
  }
})

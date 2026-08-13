import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStartupInfo } from '../../src/acp/agent.js'

test('buildStartupInfo gives semantic-first IntelliJ guidance', () => {
  const startupInfo = buildStartupInfo({
    cwd: '/workspace/project',
    fileCommands: [],
    updateNotice: null,
    bridgeTools: [
      { exposedName: 'ide_intellij_search_symbol', connectionId: 'stdio-1', remoteName: 'search_symbol', inputSchema: {} },
      { exposedName: 'ide_intellij_get_file_problems', connectionId: 'stdio-1', remoteName: 'get_file_problems', inputSchema: {} },
      { exposedName: 'ide_intellij_xdebug_start_debugger_session', connectionId: 'stdio-1', remoteName: 'xdebug_start_debugger_session', inputSchema: {} }
    ],
    bridgeProjectPath: '/workspace/project',
    bridgeCatalogComplete: true
  })

  assert.match(startupInfo, /## IDE Tools/)
  assert.match(startupInfo, /3 tools registered/)
  assert.match(startupInfo, /\/workspace\/project/)
  assert.match(startupInfo, /search_symbol, get_file_problems/)
  assert.match(startupInfo, /Registered remote tools: search_symbol, get_file_problems, xdebug_start_debugger_session/)
})

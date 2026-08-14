import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  collectChangedFiles,
  inspectionSummary,
  runEnforcedInspection,
  type InspectionBridge
} from '../../src/acp/ide-inspection.js'
import { AcpMcpBridge } from '../../src/acp/mcp-bridge.js'

function makeGitRepo(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'ide-inspect-'))
  const git = (args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf-8' })
  git(['init', '-q'])
  git(['config', 'user.email', 't@example.com'])
  git(['config', 'user.name', 'T'])
  writeFileSync(join(dir, 'a.ts'), 'export const a = 1\n')
  git(['add', 'a.ts'])
  git(['commit', '-qm', 'init'])
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

function fakeBridge(tools: Record<string, unknown>): InspectionBridge {
  return {
    hasRemoteTool: name => name in tools,
    callRemoteTool: async (name: string) => tools[name]
  }
}

describe('collectChangedFiles', () => {
  it('lists modified tracked files', () => {
    const repo = makeGitRepo()
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'export const a = 2\n')
      assert.deepEqual(collectChangedFiles(repo.dir), ['a.ts'])
    } finally {
      repo.cleanup()
    }
  })

  it('returns [] outside a git repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ide-inspect-'))
    try {
      assert.deepEqual(collectChangedFiles(dir), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('excludes node_modules and .pi from changed files', () => {
    const repo = makeGitRepo()
    try {
      mkdirSync(join(repo.dir, 'node_modules'), { recursive: true })
      mkdirSync(join(repo.dir, '.pi', 'work'), { recursive: true })
      writeFileSync(join(repo.dir, 'node_modules', 'x.js'), '1')
      writeFileSync(join(repo.dir, '.pi', 'work', 'report.json'), '{}')
      writeFileSync(join(repo.dir, 'b.ts'), 'export const b = 1\n')
      assert.deepEqual(collectChangedFiles(repo.dir), ['b.ts'])
    } finally {
      repo.cleanup()
    }
  })
})

describe('runEnforcedInspection', () => {
  it('skips without a bridge', async () => {
    const outcome = await runEnforcedInspection({ cwd: process.cwd(), sessionId: 's1' })
    assert.deepEqual(outcome, { status: 'skipped', reason: 'no IDE MCP bridge' })
  })

  it('skips when inspection tools are unavailable', async () => {
    const outcome = await runEnforcedInspection({
      bridge: fakeBridge({ echo: {} }),
      cwd: process.cwd(),
      sessionId: 's1'
    })
    assert.equal(outcome.status, 'skipped')
    assert.match((outcome as { reason: string }).reason, /unavailable/)
  })

  it('skips when no files changed', async () => {
    const repo = makeGitRepo()
    try {
      const outcome = await runEnforcedInspection({
        bridge: fakeBridge({ lint_files: {} }),
        cwd: repo.dir,
        sessionId: 's1'
      })
      assert.deepEqual(outcome, { status: 'skipped', reason: 'no changed files to inspect' })
    } finally {
      repo.cleanup()
    }
  })

  it('skips (rather than throwing) when the tool call fails', async () => {
    const repo = makeGitRepo()
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'export const a = 2\n')
      const bridge: InspectionBridge = {
        hasRemoteTool: () => true,
        callRemoteTool: async () => {
          throw new Error('boom')
        }
      }
      const outcome = await runEnforcedInspection({ bridge, cwd: repo.dir, sessionId: 's1' })
      assert.equal(outcome.status, 'skipped')
      assert.match((outcome as { reason: string }).reason, /IDE inspection failed: boom/)
    } finally {
      repo.cleanup()
    }
  })

  it('inspects changed files via lint_files and persists a report', async () => {
    const repo = makeGitRepo()
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'export const a = 2\n')
      const outputDir = join(repo.dir, '.pi', 'work', 'ide-inspections')
      const bridge = fakeBridge({
        lint_files: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                items: [{ filePath: 'a.ts', problems: [{ severity: 'WARNING', description: 'redundant', line: 1 }] }]
              })
            }
          ]
        }
      })
      const outcome = await runEnforcedInspection({ bridge, cwd: repo.dir, sessionId: 's1', outputDir })
      assert.equal(outcome.status, 'inspected')
      if (outcome.status !== 'inspected') return
      assert.equal(outcome.report.filesChecked, 1)
      assert.equal(outcome.report.warnings, 1)
      assert.equal(outcome.report.errors, 0)
      assert.equal(outcome.report.items[0]?.filePath, 'a.ts')
      assert.ok(outcome.reportPath)
      assert.ok(existsSync(outcome.reportPath as string))
      const summary = inspectionSummary(outcome)
      assert.ok(summary)
      if (summary) assert.match(summary, /IDE inspection: 1 files · 0 errors · 1 warnings/)
    } finally {
      repo.cleanup()
    }
  })

  it('counts ERROR-severity problems as errors', async () => {
    const repo = makeGitRepo()
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'export const a = 2\n')
      const bridge = fakeBridge({
        lint_files: { items: [{ filePath: 'a.ts', problems: [{ severity: 'ERROR', description: 'boom' }] }] }
      })
      const outcome = await runEnforcedInspection({
        bridge,
        cwd: repo.dir,
        sessionId: 's1',
        outputDir: join(repo.dir, 'out')
      })
      assert.equal(outcome.status, 'inspected')
      if (outcome.status !== 'inspected') return
      assert.equal(outcome.report.errors, 1)
      assert.equal(outcome.report.warnings, 0)
    } finally {
      repo.cleanup()
    }
  })

  it('falls back to get_file_problems when lint_files is unavailable', async () => {
    const repo = makeGitRepo()
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'export const a = 2\n')
      const bridge = fakeBridge({
        get_file_problems: { filePath: 'a.ts', errors: [{ severity: 'WARNING', description: 'w', line: 2 }] }
      })
      const outcome = await runEnforcedInspection({
        bridge,
        cwd: repo.dir,
        sessionId: 's1',
        outputDir: join(repo.dir, 'out')
      })
      assert.equal(outcome.status, 'inspected')
      if (outcome.status !== 'inspected') return
      assert.equal(outcome.report.filesChecked, 1)
      assert.equal(outcome.report.warnings, 1)
      assert.equal(outcome.report.items[0]?.filePath, 'a.ts')
    } finally {
      repo.cleanup()
    }
  })
})

describe('AcpMcpBridge adapter-side inspection access', () => {
  class InspectFakeConn {
    calls: Array<{ method: string; params: any }> = []
    tools = [
      { name: 'lint_files', description: 'Lint', inputSchema: { type: 'object' } },
      { name: 'get_file_problems', description: 'Problems', inputSchema: { type: 'object' } }
    ]

    async extMethod(method: string, params: any): Promise<any> {
      this.calls.push({ method, params })
      if (method === 'mcp/connect') return { connectionId: `conn-${params.acpId}` }
      if (method === 'mcp/message') {
        if (params.method === 'tools/list') return { tools: this.tools }
        if (params.method === 'tools/call') return { content: [{ type: 'text', text: 'linted' }], isError: false }
        if (params.method === 'initialize') return { protocolVersion: '2025-03-26' }
        return {}
      }
      if (method === 'mcp/disconnect') return {}
      throw new Error(`unexpected extMethod: ${method}`)
    }

    async extNotification(): Promise<void> {}
  }

  const acpServer = (id: string, name: string) => ({ type: 'acp', id, name })

  it('hasRemoteTool matches remote and exposed names', async () => {
    const bridge = new AcpMcpBridge(new InspectFakeConn() as any, [acpServer('m1', 'idea')] as any, 's1', {
      cwd: process.cwd()
    })
    await bridge.start()
    assert.equal(bridge.hasRemoteTool('lint_files'), true)
    const lint = bridge.tools.find(tool => tool.remoteName === 'lint_files')
    assert.ok(lint)
    assert.equal(bridge.hasRemoteTool(lint!.exposedName), true)
    assert.equal(bridge.hasRemoteTool('missing'), false)
    await bridge.dispose()
  })

  it('callRemoteTool routes tools/call and returns the raw result', async () => {
    const conn = new InspectFakeConn()
    const bridge = new AcpMcpBridge(conn as any, [acpServer('m1', 'idea')] as any, 's1', { cwd: process.cwd() })
    await bridge.start()
    const result = await bridge.callRemoteTool('lint_files', { files: ['a.ts'] })
    assert.deepEqual(result, { content: [{ type: 'text', text: 'linted' }], isError: false })
    const call = conn.calls.find(c => c.method === 'mcp/message' && c.params.method === 'tools/call')
    assert.equal(call?.params.params.name, 'lint_files')
    assert.deepEqual(call?.params.params.arguments, { files: ['a.ts'] })
    await bridge.dispose()
  })

  it('callRemoteTool rejects unknown tools', async () => {
    const bridge = new AcpMcpBridge(new InspectFakeConn() as any, [acpServer('m1', 'idea')] as any, 's1', {
      cwd: process.cwd()
    })
    await bridge.start()
    await assert.rejects(() => bridge.callRemoteTool('nope', {}), /Unknown IDE tool: nope/)
    await bridge.dispose()
  })
})

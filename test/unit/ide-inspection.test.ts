import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  collectChangedFiles,
  discoverInspectionScripts,
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
    callRemoteTool: async (name: string, args?: Record<string, unknown>) => {
      const tool = tools[name]
      if (typeof tool === 'function') return (tool as (toolArgs?: Record<string, unknown>) => unknown)(args)
      return tool
    }
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

describe('discoverInspectionScripts', () => {
  it('returns [] when the inspections directory is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ide-inspect-'))
    try {
      assert.deepEqual(discoverInspectionScripts(dir), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('discovers sorted *.inspection.kts scripts and skips other files', () => {
    const repo = makeGitRepo()
    try {
      mkdirSync(join(repo.dir, 'inspections'), { recursive: true })
      writeFileSync(join(repo.dir, 'inspections', 'b.inspection.kts'), 'b')
      writeFileSync(join(repo.dir, 'inspections', 'a.inspection.kts'), 'a')
      writeFileSync(join(repo.dir, 'inspections', 'readme.md'), 'nope')
      const scripts = discoverInspectionScripts(repo.dir)
      assert.deepEqual(
        scripts.map(script => script.path),
        ['inspections/a.inspection.kts', 'inspections/b.inspection.kts']
      )
      assert.deepEqual(
        scripts.map(script => script.code),
        ['a', 'b']
      )
    } finally {
      repo.cleanup()
    }
  })
})

describe('runEnforcedInspection — custom inspection.kts', () => {
  function ktsRepo(scripts: Record<string, string>) {
    const repo = makeGitRepo()
    mkdirSync(join(repo.dir, 'inspections'), { recursive: true })
    for (const [name, code] of Object.entries(scripts)) writeFileSync(join(repo.dir, 'inspections', name), code)
    return repo
  }

  it('runs repo inspection.kts scripts over changed files and folds problems into the report', async () => {
    const repo = ktsRepo({ 'no-any.inspection.kts': 'kotlin rule' })
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'const x: any = 1\n')
      const bridge = fakeBridge({
        lint_files: [{ filePath: 'a.ts', problems: [{ severity: 'warning', description: 'built-in', line: 1 }] }],
        run_inspection_kts: {
          structuredContent: {
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
          }
        }
      })
      const outcome = await runEnforcedInspection({ bridge, cwd: repo.dir, sessionId: 's1' })
      assert.equal(outcome.status, 'inspected')
      if (outcome.status !== 'inspected') return
      const item = outcome.report.items.find(entry => entry.filePath === 'a.ts')
      assert.ok(item)
      assert.equal(item.problems.length, 2)
      const ktsProblem = item.problems.find(problem => problem.description?.includes("Avoid declaring 'any'"))
      assert.ok(ktsProblem)
      assert.equal(ktsProblem.severity, 'warning')
      assert.equal(ktsProblem.line, 1)
      const ktsSummaries = outcome.report.kts
      assert.ok(ktsSummaries)
      if (!ktsSummaries) return
      assert.equal(ktsSummaries.length, 1)
      const first = ktsSummaries[0]
      assert.ok(first)
      if (!first) return
      assert.equal(first.status, 'ok')
      assert.equal(first.filesRun, 1)
      assert.equal(first.problems, 1)
    } finally {
      repo.cleanup()
    }
  })

  it('records compile errors as a diagnostic without failing the inspection', async () => {
    const repo = ktsRepo({ 'broken.inspection.kts': 'not valid kotlin' })
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'x\n')
      const bridge = fakeBridge({
        lint_files: [],
        run_inspection_kts: {
          structuredContent: {
            compilationSuccess: false,
            compilationStatus: 'ScriptException: incomplete code',
            compilationErrorDetails: 'long stack trace\nsecond line'
          }
        }
      })
      const outcome = await runEnforcedInspection({ bridge, cwd: repo.dir, sessionId: 's1' })
      assert.equal(outcome.status, 'inspected')
      if (outcome.status !== 'inspected') return
      const entry = outcome.report.kts?.[0]
      assert.ok(entry)
      if (!entry) return
      assert.equal(entry.status, 'compile-error')
      assert.ok(entry.message?.includes('ScriptException'))
      assert.ok(!(entry.message ?? '').includes('second line'))
      assert.ok(inspectionSummary(outcome)?.includes('custom inspections degraded'))
    } finally {
      repo.cleanup()
    }
  })

  it('skips the KTS pass when run_inspection_kts is unavailable', async () => {
    const repo = ktsRepo({ 'no-any.inspection.kts': 'rule' })
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'x\n')
      const bridge = fakeBridge({ lint_files: [] })
      const outcome = await runEnforcedInspection({ bridge, cwd: repo.dir, sessionId: 's1' })
      assert.equal(outcome.status, 'inspected')
      if (outcome.status !== 'inspected') return
      assert.equal(outcome.report.kts, undefined)
    } finally {
      repo.cleanup()
    }
  })

  it('degrades when a KTS call throws and keeps built-in findings', async () => {
    const repo = ktsRepo({ 'no-any.inspection.kts': 'rule' })
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'x\n')
      const bridge = fakeBridge({
        lint_files: [{ filePath: 'a.ts', problems: [{ severity: 'error', description: 'kept', line: 2 }] }],
        run_inspection_kts: () => {
          throw new Error('transport down')
        }
      })
      const outcome = await runEnforcedInspection({ bridge, cwd: repo.dir, sessionId: 's1' })
      assert.equal(outcome.status, 'inspected')
      if (outcome.status !== 'inspected') return
      const entry = outcome.report.kts?.[0]
      assert.ok(entry)
      if (!entry) return
      assert.equal(entry.status, 'error')
      assert.ok(entry.message?.includes('transport down'))
      assert.equal(outcome.report.errors, 1)
      assert.equal(outcome.report.items[0]?.problems[0]?.description, 'kept')
    } finally {
      repo.cleanup()
    }
  })

  it('maps KTS highlightType ERROR to error severity in counts', async () => {
    const repo = ktsRepo({ 'no-any.inspection.kts': 'rule' })
    try {
      writeFileSync(join(repo.dir, 'a.ts'), 'x\n')
      const bridge = fakeBridge({
        lint_files: [],
        run_inspection_kts: {
          structuredContent: {
            compilationSuccess: true,
            foundProblems: [{ message: 'boom', lineNumber: 3, highlightType: 'ERROR' }]
          }
        }
      })
      const outcome = await runEnforcedInspection({ bridge, cwd: repo.dir, sessionId: 's1' })
      assert.equal(outcome.status, 'inspected')
      if (outcome.status !== 'inspected') return
      assert.equal(outcome.report.errors, 1)
      assert.equal(outcome.report.warnings, 0)
    } finally {
      repo.cleanup()
    }
  })
})
import { computeMutationViolations } from '../../src/acp/ide-inspection.js'

describe('computeMutationViolations', () => {
  it('returns changed paths not covered by the IDE-applied ledger', () => {
    assert.deepEqual(computeMutationViolations(['src/a.ts'], ['src/a.ts']), [])
    assert.deepEqual(computeMutationViolations(['src/a.ts'], []), ['src/a.ts'])
    assert.deepEqual(computeMutationViolations(['src/a.ts', 'src/b.ts'], ['src/b.ts']), ['src/a.ts'])
  })

  it('handles empty inputs and dedupes', () => {
    assert.deepEqual(computeMutationViolations([], []), [])
    assert.deepEqual(computeMutationViolations(['src/a.ts', 'src/a.ts'], ['other.ts']), ['src/a.ts'])
  })
})


import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REPORT_SCHEMA = 'pi-acp.ide-inspection.v1'
const DEFAULT_MAX_FILES = 200
const DEFAULT_TIMEOUT_MS = 30_000
const EXCLUDED_PREFIXES = ['node_modules/', 'dist/', '.git/', '.pi/', 'inspections/'] as const
const KTS_SCRIPT_DIR = 'inspections'
const KTS_SCRIPT_SUFFIX = '.inspection.kts'
const DEFAULT_MAX_KTS_SCRIPTS = 8
const DEFAULT_MAX_KTS_CALLS = 120
const MAX_KTS_SCRIPT_BYTES = 64 * 1024

export interface IdeInspectionProblem {
  severity: string
  description?: string
  line?: number
  column?: number
  lineContent?: string
}

export interface IdeInspectionFile {
  filePath: string
  problems: IdeInspectionProblem[]
}

export interface IdeInspectionReport {
  schema: 'pi-acp.ide-inspection.v1'
  sessionId: string
  generatedAt: string
  filesChecked: number
  errors: number
  warnings: number
  items: IdeInspectionFile[]
  /** Per-script outcomes for repo inspection.kts scripts (absent when unused). */
  kts?: IdeKtsSummary[]
}

export interface IdeKtsSummary {
  scriptPath: string
  status: 'ok' | 'compile-error' | 'error' | 'malformed'
  filesRun: number
  problems: number
  message?: string
}

export interface IdeKtsScript {
  path: string
  code: string
}

interface IdeKtsRunOutcome {
  status: IdeKtsSummary['status']
  problems: IdeInspectionProblem[]
  message?: string
}

export type IdeInspectionOutcome =
  | { status: 'inspected'; report: IdeInspectionReport; reportPath?: string }
  | { status: 'skipped'; reason: string }

/** Structural bridge surface the gate needs; AcpMcpBridge satisfies it. */
export interface InspectionBridge {
  hasRemoteTool(name: string): boolean
  callRemoteTool(name: string, args: Record<string, unknown>, timeoutMs?: number): Promise<unknown>
}

export interface RunEnforcedInspectionOptions {
  bridge?: InspectionBridge | null
  cwd: string
  sessionId: string
  outputDir?: string
  maxFiles?: number
  maxKtsCalls?: number
  timeoutMs?: number
}

/**
 * List tracked/untracked files changed in the working tree of `cwd`, bounded to
 * source-adjacent files. Returns [] when git is missing, `cwd` is not a
 * repository, or nothing changed.
 */
export function collectChangedFiles(cwd: string, maxFiles = DEFAULT_MAX_FILES): string[] {
  const result = spawnSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 4 * 1024 * 1024
  })
  if (result.error || result.status !== 0) return []

  const raw = typeof result.stdout === 'string' ? result.stdout : ''
  const files: string[] = []
  for (const entry of raw.split('\0')) {
    if (!entry) continue
    const match = entry.match(/^(..)\s+(.+)$/s)
    const path = match ? match[2].trim() : ''
    if (!path) continue
    if (EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix))) continue
    if (path.includes('\0')) continue
    if (!existsSync(join(cwd, path))) continue
    files.push(path)
    if (files.length >= maxFiles) break
  }
  return files
}

function isErrorSeverity(severity: string): boolean {
  return /error/i.test(severity)
}

function isWarningSeverity(severity: string): boolean {
  return /warn/i.test(severity)
}

function toProblem(item: unknown): IdeInspectionProblem | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const severity =
    typeof record.severity === 'string' ? record.severity : typeof record.level === 'string' ? record.level : undefined
  if (!severity) return null
  return {
    severity,
    description: typeof record.description === 'string' ? record.description : undefined,
    line: typeof record.line === 'number' ? record.line : undefined,
    column: typeof record.column === 'number' ? record.column : undefined,
    lineContent: typeof record.lineContent === 'string' ? record.lineContent : undefined
  }
}

function toFile(item: unknown): IdeInspectionFile | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const filePath =
    typeof record.filePath === 'string' ? record.filePath : typeof record.path === 'string' ? record.path : undefined
  if (!filePath) return null
  const rawProblems = Array.isArray(record.problems)
    ? record.problems
    : Array.isArray(record.errors)
      ? record.errors
      : Array.isArray(record.items)
        ? record.items
        : Array.isArray(record.issues)
          ? record.issues
          : []
  const problems = rawProblems.map(toProblem).filter((p): p is IdeInspectionProblem => p !== null)
  return { filePath, problems }
}

/** Unwrap the varied MCP tool-result wrappers (structuredContent, content-text JSON) to the logical payload. */
function unwrapToolResult(raw: unknown): unknown {
  let data = raw

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (record.structuredContent && typeof record.structuredContent === 'object') {
      data = record.structuredContent
    } else if (Array.isArray(record.content)) {
      const text = record.content
        .map(part =>
          part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
            ? (part as { text: string }).text
            : ''
        )
        .join('\n')
        .trim()
      if (!text) return {}
      try {
        data = JSON.parse(text)
      } catch {
        return {}
      }
    }
  }
  return data
}

/**
 * Normalize the varied shapes IntelliJ's MCP server (or a fixture) may return
 * for lint_files/get_file_problems: a raw items array, a {items|results|files}
 * envelope, or an MCP tool result with text JSON / structuredContent.
 */
function normalizeInspectionResult(raw: unknown): IdeInspectionFile[] {
  const data = unwrapToolResult(raw)

  if (Array.isArray(data)) return data.map(toFile).filter((f): f is IdeInspectionFile => f !== null)
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const arr = Array.isArray(record.items)
      ? record.items
      : Array.isArray(record.results)
        ? record.results
        : Array.isArray(record.files)
          ? record.files
          : Array.isArray(record.problems)
            ? record.problems
            : Array.isArray(record.issues)
              ? record.issues
              : null
    if (arr) return arr.map(toFile).filter((f): f is IdeInspectionFile => f !== null)
    // Single-file shape (e.g. get_file_problems → { filePath, errors: [...] }).
    const single = toFile(data)
    if (single) return [single]
  }
  return []
}

function ktsSeverity(highlightType: unknown): string {
  const value = typeof highlightType === 'string' ? highlightType.toLowerCase() : ''
  if (value.includes('error') && !value.includes('warning')) return 'error'
  return 'warning'
}

/**
 * Normalize an IntelliJ run_inspection_kts result: success shape
 * { compilationSuccess, inspectionResultMessage, foundProblems[] }, compile
 * failure shape { compilationSuccess:false, compilationStatus,
 * compilationErrorDetails }, or 'malformed' for anything else.
 */
function normalizeKtsResult(raw: unknown): IdeKtsRunOutcome {
  const data = unwrapToolResult(raw)
  if (!data || typeof data !== 'object') return { status: 'malformed', problems: [] }
  const record = data as Record<string, unknown>

  if (record.compilationSuccess === false) {
    const status = typeof record.compilationStatus === 'string' ? record.compilationStatus : 'compilation failed'
    const details = typeof record.compilationErrorDetails === 'string' ? record.compilationErrorDetails : ''
    const firstLine = details.split('\n').find(line => line.trim()) ?? ''
    return {
      status: 'compile-error',
      problems: [],
      message: `${status}${firstLine ? ` — ${firstLine.trim().slice(0, 300)}` : ''}`
    }
  }

  if (record.compilationSuccess !== true || !Array.isArray(record.foundProblems)) {
    return { status: 'malformed', problems: [] }
  }

  const problems = record.foundProblems
    .map((item): IdeInspectionProblem | null => {
      if (!item || typeof item !== 'object') return null
      const entry = item as Record<string, unknown>
      const message = typeof entry.message === 'string' ? entry.message : undefined
      if (!message) return null
      return {
        severity: ktsSeverity(entry.highlightType),
        description: message,
        line: typeof entry.lineNumber === 'number' ? entry.lineNumber : undefined,
        lineContent: typeof entry.elementText === 'string' ? entry.elementText : undefined
      }
    })
    .filter((p): p is IdeInspectionProblem => p !== null)

  return { status: 'ok', problems }
}

/**
 * Discover repo inspection.kts scripts under <cwd>/inspections, bounded and in
 * deterministic (sorted) order. Returns [] when the directory is missing or a
 * script is unreadable/oversized.
 */
export function discoverInspectionScripts(cwd: string, maxScripts = DEFAULT_MAX_KTS_SCRIPTS): IdeKtsScript[] {
  let names: string[]
  try {
    names = readdirSync(join(cwd, KTS_SCRIPT_DIR), { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(KTS_SCRIPT_SUFFIX))
      .map(entry => entry.name)
      .sort()
  } catch {
    return []
  }
  const scripts: IdeKtsScript[] = []
  for (const name of names) {
    if (scripts.length >= maxScripts) break
    const path = `${KTS_SCRIPT_DIR}/${name}`
    try {
      const code = readFileSync(join(cwd, path), 'utf8').trim()
      if (code.length > MAX_KTS_SCRIPT_BYTES) continue
      scripts.push({ path, code })
    } catch {
      // unreadable script is skipped
    }
  }
  return scripts
}

interface KtsPassResult {
  summaries: IdeKtsSummary[]
  truncated: boolean
  fileProblems: Map<string, IdeInspectionProblem[]>
}

/**
 * Run discovered repo inspection.kts scripts over changed files via the
 * bridge's run_inspection_kts tool. Never throws: an unavailable tool yields
 * null; call failures and compile errors degrade to per-script summaries.
 */
async function runKtsInspections(opts: {
  bridge: InspectionBridge
  cwd: string
  files: string[]
  timeoutMs: number
  maxCalls?: number
}): Promise<KtsPassResult | null> {
  const { bridge, cwd, files, timeoutMs } = opts
  if (!bridge.hasRemoteTool('run_inspection_kts')) return null
  const scripts = discoverInspectionScripts(cwd)
  if (scripts.length === 0) return { summaries: [], truncated: false, fileProblems: new Map() }

  const maxCalls = opts.maxCalls ?? DEFAULT_MAX_KTS_CALLS
  const statusRank = { ok: 0, malformed: 1, error: 2, 'compile-error': 3 } as const
  const acc = new Map<
    string,
    { status: IdeKtsSummary['status']; problems: IdeInspectionProblem[]; message?: string; filesRun: number }
  >()
  for (const script of scripts) acc.set(script.path, { status: 'ok', problems: [], filesRun: 0 })

  const fileProblems = new Map<string, IdeInspectionProblem[]>()
  let calls = 0
  let truncated = false
  for (const file of files) {
    for (const script of scripts) {
      if (calls >= maxCalls) {
        truncated = true
        break
      }
      calls += 1
      const entry = acc.get(script.path)!
      entry.filesRun += 1
      let outcome: IdeKtsRunOutcome
      try {
        const raw = await bridge.callRemoteTool(
          'run_inspection_kts',
          { inspectionKtsCode: script.code, contextPath: file },
          timeoutMs
        )
        outcome = normalizeKtsResult(raw)
      } catch (error) {
        outcome = {
          status: 'error',
          problems: [],
          message: error instanceof Error ? error.message : String(error)
        }
      }
      if (outcome.problems.length > 0) {
        const existing = fileProblems.get(file)
        if (existing) existing.push(...outcome.problems)
        else fileProblems.set(file, [...outcome.problems])
      }
      entry.problems.push(...outcome.problems)
      if (outcome.status !== 'ok' && !entry.message) entry.message = outcome.message
      if (statusRank[outcome.status] > statusRank[entry.status]) entry.status = outcome.status
    }
    if (truncated) break
  }

  const summaries: IdeKtsSummary[] = [...acc.entries()].map(([scriptPath, entry]) => ({
    scriptPath,
    status: entry.status,
    filesRun: entry.filesRun,
    problems: entry.problems.length,
    message: entry.message
  }))
  return { summaries, truncated, fileProblems }
}

function renderMarkdown(report: IdeInspectionReport): string {
  const lines: string[] = []
  lines.push('# IDE inspection', '')
  lines.push(`Session: ${report.sessionId}`)
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push(`Files checked: ${report.filesChecked} · Errors: ${report.errors} · Warnings: ${report.warnings}`)
  if (report.items.length === 0) {
    lines.push('', 'No findings.')
  } else {
    for (const item of report.items) {
      lines.push('', `## ${item.filePath} (${item.problems.length} problem${item.problems.length === 1 ? '' : 's'})`)
      for (const problem of item.problems) {
        const loc =
          typeof problem.line === 'number'
            ? `:${problem.line}${typeof problem.column === 'number' ? `:${problem.column}` : ''}`
            : ''
        lines.push(`- [${problem.severity}]${loc} ${problem.description ?? ''}`.trim())
      }
    }
  }
  if (report.kts && report.kts.length > 0) {
    lines.push('', '## Custom inspections (KTS)')
    for (const summary of report.kts) {
      const detail =
        summary.status === 'ok'
          ? `${summary.filesRun} file${summary.filesRun === 1 ? '' : 's'} · ${summary.problems} problem${summary.problems === 1 ? '' : 's'}`
          : `${summary.status}${summary.message ? ` — ${summary.message}` : ''}`
      lines.push(`- ${summary.scriptPath} — ${detail}`)
    }
  }
  return lines.join('\n') + '\n'
}

function writeReport(report: IdeInspectionReport, opts: RunEnforcedInspectionOptions): string | undefined {
  const base = opts.outputDir ?? join(opts.cwd, '.pi', 'work', 'ide-inspections')
  const dir = join(base, report.sessionId)
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    return undefined
  }
  const stamp = report.generatedAt.replace(/[:.]/g, '-')
  const jsonPath = join(dir, `${stamp}.json`)
  const mdPath = join(dir, `${stamp}.md`)
  try {
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(mdPath, renderMarkdown(report))
  } catch {
    return undefined
  }
  return jsonPath
}

/**
 * Run the enforced post-turn IDE inspection. Never throws: a missing bridge,
 * unavailable tools, no changed files, or a failing tool call degrade to a
 * `skipped` outcome the caller can surface (or ignore) without breaking the
 * turn.
 */
export async function runEnforcedInspection(opts: RunEnforcedInspectionOptions): Promise<IdeInspectionOutcome> {
  const bridge = opts.bridge
  if (!bridge) return { status: 'skipped', reason: 'no IDE MCP bridge' }

  const hasLint = bridge.hasRemoteTool('lint_files')
  const hasProblems = bridge.hasRemoteTool('get_file_problems')
  if (!hasLint && !hasProblems) {
    return { status: 'skipped', reason: 'IDE inspection tools (lint_files/get_file_problems) unavailable' }
  }

  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const files = collectChangedFiles(opts.cwd, maxFiles)
  if (files.length === 0) return { status: 'skipped', reason: 'no changed files to inspect' }

  let items: IdeInspectionFile[]
  try {
    if (hasLint) {
      const raw = await bridge.callRemoteTool('lint_files', { files, min_severity: 'warning' }, timeoutMs)
      items = normalizeInspectionResult(raw)
    } else {
      const results = await Promise.all(
        files.map(file => bridge.callRemoteTool('get_file_problems', { filePath: file, errorsOnly: false }, timeoutMs))
      )
      items = results.map(normalizeInspectionResult).flat()
    }
  } catch (error) {
    return {
      status: 'skipped',
      reason: `IDE inspection failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  let kts: IdeKtsSummary[] | undefined
  try {
    const ktsResult = await runKtsInspections({
      bridge,
      cwd: opts.cwd,
      files,
      timeoutMs,
      maxCalls: opts.maxKtsCalls
    })
    if (ktsResult) {
      for (const [file, problems] of ktsResult.fileProblems) {
        const existing = items.find(item => item.filePath === file)
        if (existing) existing.problems.push(...problems)
        else items.push({ filePath: file, problems })
      }
      kts = ktsResult.truncated
        ? [
            ...ktsResult.summaries,
            {
              scriptPath: '(truncated)',
              status: 'error',
              filesRun: 0,
              problems: 0,
              message: 'KTS call budget exceeded — remaining file/script runs skipped'
            }
          ]
        : ktsResult.summaries
    }
  } catch {
    kts = [
      { scriptPath: '(gate)', status: 'error', filesRun: 0, problems: 0, message: 'KTS inspection pass failed' }
    ]
  }

  const errors = items.reduce(
    (n, item) => n + item.problems.filter(problem => isErrorSeverity(problem.severity)).length,
    0
  )
  const warnings = items.reduce(
    (n, item) => n + item.problems.filter(problem => isWarningSeverity(problem.severity)).length,
    0
  )

  const report: IdeInspectionReport = {
    schema: REPORT_SCHEMA,
    sessionId: opts.sessionId,
    generatedAt: new Date().toISOString(),
    filesChecked: files.length,
    errors,
    warnings,
    items,
    kts
  }

  const reportPath = writeReport(report, opts)
  return { status: 'inspected', report, reportPath }
}

/** One-line chat summary for an inspected outcome (null for skipped). */
export function inspectionSummary(outcome: IdeInspectionOutcome): string | null {
  if (outcome.status !== 'inspected') return null
  const report = outcome.report
  const reportRef = outcome.reportPath ? ` (report: ${outcome.reportPath})` : ''
  const ktsDegraded = report.kts?.some(summary => summary.status !== 'ok') ?? false
  const ktsNote = ktsDegraded ? ' · custom inspections degraded' : ''
  return `IDE inspection: ${report.filesChecked} files · ${report.errors} errors · ${report.warnings} warnings${ktsNote}${reportRef}`
}

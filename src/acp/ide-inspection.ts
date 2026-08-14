import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REPORT_SCHEMA = 'pi-acp.ide-inspection.v1'
const DEFAULT_MAX_FILES = 200
const DEFAULT_TIMEOUT_MS = 30_000
const EXCLUDED_PREFIXES = ['node_modules/', 'dist/', '.git/', '.pi/'] as const

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

/**
 * Normalize the varied shapes IntelliJ's MCP server (or a fixture) may return
 * for lint_files/get_file_problems: a raw items array, a {items|results|files}
 * envelope, or an MCP tool result with text JSON / structuredContent.
 */
function normalizeInspectionResult(raw: unknown): IdeInspectionFile[] {
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
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          return []
        }
      } else {
        return []
      }
    }
  }

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
    items
  }

  const reportPath = writeReport(report, opts)
  return { status: 'inspected', report, reportPath }
}

/** One-line chat summary for an inspected outcome (null for skipped). */
export function inspectionSummary(outcome: IdeInspectionOutcome): string | null {
  if (outcome.status !== 'inspected') return null
  const report = outcome.report
  const reportRef = outcome.reportPath ? ` (report: ${outcome.reportPath})` : ''
  return `IDE inspection: ${report.filesChecked} files · ${report.errors} errors · ${report.warnings} warnings${reportRef}`
}

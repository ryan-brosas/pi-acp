import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AvailableCommand } from '@agentclientprotocol/sdk'

/**
 * File-based slash command (mirrors pi-coding-agent semantics).
 */
export type FileSlashCommand = {
  name: string
  description: string
  content: string
  source: string // e.g. "(user)", "(project)", "(project:frontend)"
  argumentHint?: string
}

function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>
  content: string
} {
  const frontmatter: Record<string, string> = {}

  if (!content.startsWith('---')) return { frontmatter, content }

  const endIndex = content.indexOf('\n---', 3)
  if (endIndex === -1) return { frontmatter, content }

  const frontmatterBlock = content.slice(4, endIndex)
  const remaining = content.slice(endIndex + 4).trim()

  for (const line of frontmatterBlock.split('\n')) {
    const match = line.match(/^([\w-]+):\s*(.*)$/)
    if (match) {
      const value = match[2].trim()
      const quoted =
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      frontmatter[match[1]] = quoted ? value.slice(1, -1) : value
    }
  }

  return { frontmatter, content: remaining }
}

function loadCommandsFromDir(dir: string, source: 'user' | 'project', subdir = ''): FileSlashCommand[] {
  const commands: FileSlashCommand[] = []
  if (!existsSync(dir)) return commands

  try {
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        const newSubdir = subdir ? `${subdir}:${entry.name}` : entry.name
        commands.push(...loadCommandsFromDir(fullPath, source, newSubdir))
        continue
      }

      if (!entry.isFile() || !entry.name.endsWith('.md')) continue

      try {
        const rawContent = readFileSync(fullPath, 'utf-8')
        const { frontmatter, content } = parseFrontmatter(rawContent)

        const name = entry.name.slice(0, -3)

        const sourceStr =
          source === 'user' ? (subdir ? `(user:${subdir})` : '(user)') : subdir ? `(project:${subdir})` : '(project)'

        let description = frontmatter.description || ''
        if (!description) {
          const firstLine = content.split('\n').find(l => l.trim())
          if (firstLine) {
            description = firstLine.slice(0, 60)
            if (firstLine.length > 60) description += '...'
          }
        }

        description = description ? `${description} ${sourceStr}` : sourceStr

        commands.push({
          name,
          description,
          content,
          source: sourceStr,
          ...(frontmatter['argument-hint'] && { argumentHint: frontmatter['argument-hint'] })
        })
      } catch {
        // Silently skip unreadable files.
      }
    }
  } catch {
    // Silently skip unreadable dirs.
  }

  return commands
}

/**
 * Load prompt templates from pi's prompt directories (formerly "commands").
 *  - user:    ~/.pi/agent/prompts/**\/*.md
 *  - project: <cwd>/.pi/prompts/**\/*.md
 */
export function loadSlashCommands(cwd: string): FileSlashCommand[] {
  const commands: FileSlashCommand[] = []

  const userDir = join(homedir(), '.pi', 'agent', 'prompts')
  const projectDir = resolve(cwd, '.pi', 'prompts')

  // Match pi ordering: user first, then project.
  commands.push(...loadCommandsFromDir(userDir, 'user'))
  commands.push(...loadCommandsFromDir(projectDir, 'project'))

  return commands
}

/**
 * Convert file-based commands to ACP AvailableCommand objects.
 * De-dupes by name (first wins).
 */
export function toAvailableCommands(fileCommands: FileSlashCommand[]): AvailableCommand[] {
  const seen = new Set<string>()
  const out: AvailableCommand[] = []

  for (const c of fileCommands) {
    if (seen.has(c.name)) continue
    seen.add(c.name)

    out.push({
      name: c.name,
      description: c.description,
      ...(c.argumentHint && { input: { hint: c.argumentHint } })
    })
  }

  return out
}

/** Add local prompt input hints to Pi RPC command metadata without changing command precedence. */
export function withFileCommandInputs(
  commands: AvailableCommand[],
  fileCommands: FileSlashCommand[]
): AvailableCommand[] {
  const hints = new Map<string, string>()
  for (const command of fileCommands) {
    if (command.argumentHint && !hints.has(command.name)) hints.set(command.name, command.argumentHint)
  }

  return commands.map(command => {
    const hint = hints.get(command.name)
    return hint && !command.input ? { ...command, input: { hint } } : command
  })
}

/**
 * Parse command args (bash-style quotes).
 */
export function parseCommandArgs(argsString: string): string[] {
  const args: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (let i = 0; i < argsString.length; i++) {
    const ch = argsString[i]

    if (inQuote) {
      if (ch === inQuote) inQuote = null
      else current += ch
      continue
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (/\s/.test(ch)) {
      if (current) {
        args.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }

  if (current) args.push(current)
  return args
}

/** Substitute Pi prompt-template argument forms in one pass so inserted values are not expanded again. */
export function substituteArgs(content: string, args: string[]): string {
  const allArgs = args.join(' ')
  return content.replace(
    /\$\{(\d+|ARGUMENTS|@):-([^}]*)\}|\$\{@:(\d+)(?::(\d+))?\}|\$(ARGUMENTS|@|\d+)/g,
    (
      _match,
      defaultTarget: string | undefined,
      defaultValue: string | undefined,
      sliceStart: string | undefined,
      sliceLength: string | undefined,
      simple: string | undefined
    ) => {
      if (defaultTarget) {
        const value =
          defaultTarget === '@' || defaultTarget === 'ARGUMENTS'
            ? allArgs
            : args[Number.parseInt(defaultTarget, 10) - 1]
        return value || defaultValue || ''
      }
      if (sliceStart) {
        const start = Math.max(0, Number.parseInt(sliceStart, 10) - 1)
        if (sliceLength) {
          const length = Number.parseInt(sliceLength, 10)
          return args.slice(start, start + length).join(' ')
        }
        return args.slice(start).join(' ')
      }
      if (simple === 'ARGUMENTS' || simple === '@') return allArgs
      return args[Number.parseInt(simple || '', 10) - 1] ?? ''
    }
  )
}

/**
 * Expand a leading /command using the loaded file commands.
 * Returns original text if it's not a known slash command.
 */
export function expandSlashCommand(text: string, fileCommands: FileSlashCommand[]): string {
  if (!text.startsWith('/')) return text
  const match = text.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/)
  if (!match) return text

  const cmd = fileCommands.find(c => c.name === match[1])
  if (!cmd) return text

  return substituteArgs(cmd.content, parseCommandArgs(match[2] ?? ''))
}

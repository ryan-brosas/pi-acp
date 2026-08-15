#!/usr/bin/env node

import { readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('..', import.meta.url))
const intervalMs = 60_000
const maxScannedBytes = 10 * 1024 * 1024

const secretPatterns = [
  { name: 'private key', pattern: /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ }
]

function git(args) {
  return spawnSync('git', args, { cwd: repository, encoding: 'utf8', stdio: 'pipe' })
}

function changedPaths() {
  const result = git(['ls-files', '-m', '-o', '--exclude-standard', '-z'])
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Unable to list changed files')
  return [...new Set(result.stdout.split('\0').filter(Boolean))]
}

function detectSecrets(paths) {
  const findings = []
  for (const path of paths) {
    const absolutePath = `${repository}/${path}`
    let stat
    try {
      stat = statSync(absolutePath)
    } catch {
      continue
    }
    if (!stat.isFile() || stat.size > maxScannedBytes) continue
    const text = readFileSync(absolutePath, 'utf8')
    if (text.includes('\0')) continue
    for (const candidate of secretPatterns) {
      if (candidate.pattern.test(text)) findings.push(`${path}: ${candidate.name}`)
    }
  }
  return findings
}

function snapshot() {
  const paths = changedPaths()
  if (paths.length === 0) return
  const findings = detectSecrets(paths)
  if (findings.length > 0) {
    console.error(`[auto-commit] blocked: possible secrets found\n${findings.join('\n')}`)
    return
  }
  const add = git(['add', '-A'])
  if (add.status !== 0) throw new Error(add.stderr.trim() || 'git add failed')
  const staged = git(['diff', '--cached', '--name-status', '--no-renames'])
  if (staged.status !== 0) throw new Error(staged.stderr.trim() || 'Unable to inspect staged changes')
  const details = staged.stdout.trim()
  if (!details) return
  const timestamp = new Date().toISOString()
  const message = [
    `chore(auto): snapshot changes at ${timestamp}`,
    '',
    'Automatically captured all non-ignored repository changes after a 60-second interval.',
    'No remote push was performed.',
    '',
    'Changed paths:',
    details
  ].join('\n')
  const commit = git(['commit', '-m', message])
  if (commit.status !== 0) throw new Error(commit.stderr.trim() || commit.stdout.trim() || 'git commit failed')
  console.log(`[auto-commit] committed ${timestamp}\n${details}`)
}

let stopped = false
process.on('SIGINT', () => {
  stopped = true
})
process.on('SIGTERM', () => {
  stopped = true
})
console.log(`[auto-commit] watching ${repository}; interval=60s; push=disabled`)
while (!stopped) {
  await new Promise(resolve => setTimeout(resolve, intervalMs))
  if (stopped) break
  try {
    snapshot()
  } catch (error) {
    console.error(`[auto-commit] ${error instanceof Error ? error.message : String(error)}`)
  }
}

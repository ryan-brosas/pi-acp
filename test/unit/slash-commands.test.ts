import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as slashCommands from '../../src/acp/slash-commands.js'

const { expandSlashCommand, loadSlashCommands, parseCommandArgs, substituteArgs, toAvailableCommands } =
  slashCommands

test('parseCommandArgs: handles quotes and multiline whitespace', () => {
  assert.deepEqual(parseCommandArgs('a b'), ['a', 'b'])
  assert.deepEqual(parseCommandArgs("'a b' c"), ['a b', 'c'])
  assert.deepEqual(parseCommandArgs('"a b" c'), ['a b', 'c'])
  assert.deepEqual(parseCommandArgs('a\nb\tc'), ['a', 'b', 'c'])
})

test('substituteArgs: matches Pi prompt-template argument syntax', () => {
  const template =
    'pos=$1 missing=$3 all=$@ alias=$ARGUMENTS default=${3:-fallback} allDefault=${ARGUMENTS:-fallback} slice=${@:2} range=${@:1:1}'

  assert.equal(
    substituteArgs(template, ['one', 'two']),
    'pos=one missing= all=one two alias=one two default=fallback allDefault=one two slice=two range=one'
  )
  assert.equal(
    substituteArgs('${1:-7}|${@:-all-default}|${ARGUMENTS:-args-default}', []),
    '7|all-default|args-default'
  )
})

test('substituteArgs: does not recursively expand argument values', () => {
  assert.equal(substituteArgs('$1|$ARGUMENTS', ['$2']), '$2|$2')
})

test('expandSlashCommand: expands known command with all arguments', () => {
  const cmds = [{ name: 'hello', description: '(user)', content: 'Say hi to $ARGUMENTS', source: '(user)' }]

  assert.equal(expandSlashCommand('/hello "wide world" now', cmds as any), 'Say hi to wide world now')
  assert.equal(expandSlashCommand('/unknown world', cmds as any), '/unknown world')
  assert.equal(expandSlashCommand('not a command', cmds as any), 'not a command')
})

test('loadSlashCommands: carries argument-hint into ACP command input', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'pi-acp-prompt-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  mkdirSync(join(cwd, '.pi', 'prompts'), { recursive: true })
  writeFileSync(
    join(cwd, '.pi', 'prompts', 'hint-test.md'),
    '---\ndescription: Prompt with input\nargument-hint: "<topic>"\n---\nDiscuss $ARGUMENTS\n'
  )

  const command = loadSlashCommands(cwd).find(item => item.name === 'hint-test')
  assert.equal(command?.argumentHint, '<topic>')
  assert.deepEqual(toAvailableCommands([command!]), [
    { name: 'hint-test', description: 'Prompt with input (project)', input: { hint: '<topic>' } }
  ])
})

test('withFileCommandInputs: enriches Pi prompt commands without changing order or descriptions', () => {
  const enrich = (slashCommands as typeof slashCommands & {
    withFileCommandInputs: (
      commands: Array<{ name: string; description: string }>,
      fileCommands: Array<Record<string, unknown>>
    ) => unknown
  }).withFileCommandInputs
  const commands = [
    { name: 'hint-test', description: 'From Pi RPC' },
    { name: 'skill:other', description: 'Other' }
  ]
  const fileCommands = [
    {
      name: 'hint-test',
      description: 'Local',
      content: 'Discuss $ARGUMENTS',
      source: '(project)',
      argumentHint: '<topic>'
    }
  ]

  assert.deepEqual(enrich(commands, fileCommands), [
    { name: 'hint-test', description: 'From Pi RPC', input: { hint: '<topic>' } },
    { name: 'skill:other', description: 'Other' }
  ])
})

test('toAvailableCommands: de-dupes by name (first wins)', () => {
  const cmds = [
    { name: 'x', description: 'first', content: '1', source: '(user)' },
    { name: 'x', description: 'second', content: '2', source: '(project)' }
  ]

  assert.deepEqual(toAvailableCommands(cmds as any), [{ name: 'x', description: 'first' }])
})

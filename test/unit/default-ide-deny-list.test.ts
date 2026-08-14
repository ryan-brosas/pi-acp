import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extraAllowSet, isDefaultDenied } from '../../src/acp/mcp-bridge.js'

describe('default IDE deny-list', () => {
  it('denies universal execution and debugger mutation by default', () => {
    const extra = new Set<string>()
    assert.equal(isDefaultDenied('execute_tool', extra), true)
    assert.equal(isDefaultDenied('xdebug_set_breakpoint', extra), true)
    assert.equal(isDefaultDenied('xdebug_start_debugger_session', extra), true)
    assert.equal(isDefaultDenied('xdebug_control_session', extra), true)
  })

  it('keeps ordinary IDE tools off the deny-list', () => {
    const extra = new Set<string>()
    assert.equal(isDefaultDenied('lint_files', extra), false)
    assert.equal(isDefaultDenied('search_symbol', extra), false)
    assert.equal(isDefaultDenied('run_inspection_kts', extra), false)
  })

  it('re-allows a reviewed tool via the override set', () => {
    const extra = new Set(['execute_tool'])
    assert.equal(isDefaultDenied('execute_tool', extra), false)
    assert.equal(isDefaultDenied('xdebug_set_breakpoint', extra), true)
  })

  it('parses the PI_ACP_IDE_EXTRA_TOOLS env override', () => {
    const prev = process.env.PI_ACP_IDE_EXTRA_TOOLS
    process.env.PI_ACP_IDE_EXTRA_TOOLS = ' execute_tool, xdebug_set_breakpoint '
    try {
      assert.deepEqual([...extraAllowSet()], ['execute_tool', 'xdebug_set_breakpoint'])
    } finally {
      if (prev === undefined) delete process.env.PI_ACP_IDE_EXTRA_TOOLS
      else process.env.PI_ACP_IDE_EXTRA_TOOLS = prev
    }
  })

  it('treats empty and unset override as no extra tools', () => {
    const prev = process.env.PI_ACP_IDE_EXTRA_TOOLS
    delete process.env.PI_ACP_IDE_EXTRA_TOOLS
    try {
      assert.deepEqual([...extraAllowSet()], [])
    } finally {
      if (prev === undefined) delete process.env.PI_ACP_IDE_EXTRA_TOOLS
      else process.env.PI_ACP_IDE_EXTRA_TOOLS = prev
    }
  })
})

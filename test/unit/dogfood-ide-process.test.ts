import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isAdapterProcessArgs } from '../../scripts/lib/adapter-process.mjs'

describe('dogfood IDE process detection', () => {
  it('recognizes checkout and installed adapter commands', () => {
    assert.equal(isAdapterProcessArgs('node /work/pi-acp/dist/index.js'), true)
    assert.equal(isAdapterProcessArgs('/usr/local/bin/pi-acp'), true)
    assert.equal(isAdapterProcessArgs('npx pi-acp-jetbrain'), true)
  })

  it('ignores unrelated commands located inside a pi-acp checkout', () => {
    assert.equal(isAdapterProcessArgs('node /work/pi-acp/scripts/auto-commit.mjs'), false)
    assert.equal(isAdapterProcessArgs('node /work/pi-acp/scripts/dogfood-ide.mjs'), false)
  })
})

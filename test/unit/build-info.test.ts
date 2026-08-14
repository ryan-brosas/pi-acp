import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildInfo } from '../../src/build-info.js'

describe('build-info', () => {
  it('reports a revision and package version in every runtime', () => {
    assert.match(buildInfo.revision, /^[0-9a-f]{6,}$|^dev$/, `revision=${buildInfo.revision}`)
    assert.match(buildInfo.packageVersion, /^\d+\.\d+\.\d+/, `packageVersion=${buildInfo.packageVersion}`)
    assert.equal(typeof buildInfo.isRelease, 'boolean')
    assert.equal(typeof buildInfo.buildTime, 'string')
    assert.equal(typeof buildInfo.dirty, 'boolean')
  })

  it('exposes a stable shape suitable for agentInfo._meta', () => {
    assert.deepEqual(Object.keys(buildInfo).sort(), ['buildTime', 'dirty', 'isRelease', 'packageVersion', 'revision'])
  })
})

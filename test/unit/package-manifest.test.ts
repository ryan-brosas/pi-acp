import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const packagePath = fileURLToPath(new URL('../../package.json', import.meta.url))
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
  keywords?: string[]
  files?: string[]
  pi?: { extensions?: string[] }
}

test('package declares its bundled Pi extension for automatic activation', () => {
  assert.ok(packageJson.keywords?.includes('pi-package'))
  assert.ok(packageJson.files?.includes('dist'))
  assert.deepEqual(packageJson.pi?.extensions, ['./dist/pi-extension/acp-mcp-bridge.js'])
})

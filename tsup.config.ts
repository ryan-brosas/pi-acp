import { execSync } from 'node:child_process'
import { defineConfig } from 'tsup'

function gitRevision(): string {
  try {
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8', timeout: 5000 }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  entry: ['src/index.ts', 'src/pi-extension/acp-mcp-bridge.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  minify: false,
  define: {
    __PI_ACP_BUILD_REVISION__: JSON.stringify(gitRevision()),
    __PI_ACP_BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  banner: {
    js: '#!/usr/bin/env node'
  }
})

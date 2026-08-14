import test from 'node:test'
import assert from 'node:assert/strict'
import { piModelsToProviderInfo } from '../../src/acp/providers.js'

test('piModelsToProviderInfo: groups models by provider with best-effort routing', () => {
  const providers = piModelsToProviderInfo([
    { provider: 'openai', id: 'gpt-4o', baseUrl: 'https://api.openai.com/v1' },
    { provider: 'openai', id: 'gpt-4o-mini' },
    { provider: 'anthropic', id: 'claude-3-7-sonnet' }
  ])

  assert.deepEqual(providers, [
    {
      id: 'openai',
      supported: ['openai'],
      required: false,
      current: { apiType: 'openai', baseUrl: 'https://api.openai.com/v1' }
    },
    {
      id: 'anthropic',
      supported: ['anthropic'],
      required: false,
      current: { apiType: 'anthropic', baseUrl: '' }
    }
  ])
})

test('piModelsToProviderInfo: falls back to _prefixed custom protocol and skips empty providers', () => {
  const providers = piModelsToProviderInfo([
    { provider: 'my-custom', id: 'x' },
    { provider: '', id: 'y' },
    { provider: '  ', id: 'z' }
  ])

  assert.equal(providers.length, 1)
  assert.equal(providers[0]!.id, 'my-custom')
  assert.deepEqual(providers[0]!.supported, ['_my-custom'])
})

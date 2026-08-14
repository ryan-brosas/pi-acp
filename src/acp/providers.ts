import type { LlmProtocol, ProviderInfo } from '@agentclientprotocol/sdk'

const KNOWN_PROTOCOLS: Record<string, LlmProtocol> = {
  anthropic: 'anthropic',
  openai: 'openai',
  openrouter: 'openai',
  azure: 'azure',
  vertex: 'vertex',
  bedrock: 'bedrock'
}

/**
 * Maps pi's `get_available_models` payload to the UNSTABLE ACP providers/list
 * shape. One ProviderInfo per distinct provider id; routing config is best-effort
 * because pi does not expose provider base URLs or credentials through RPC.
 */
export function piModelsToProviderInfo(models: Array<Record<string, unknown>>): ProviderInfo[] {
  const byProvider = new Map<string, ProviderInfo>()

  for (const model of models) {
    const provider = String(model?.provider ?? '').trim()
    if (!provider || byProvider.has(provider)) continue

    const apiType: LlmProtocol = KNOWN_PROTOCOLS[provider.toLowerCase()] ?? `_${provider}`
    const baseUrl = typeof model?.baseUrl === 'string' ? model.baseUrl : ''

    byProvider.set(provider, {
      id: provider,
      supported: [apiType],
      required: false,
      current: { apiType, baseUrl }
    })
  }

  return [...byProvider.values()]
}

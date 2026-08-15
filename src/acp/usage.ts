import type { Usage } from '@agentclientprotocol/sdk'

interface PiSessionStatsTokens {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  total?: number
}

/**
 * Maps Pi's `get_session_stats` payload to the `usage` field of ACP's unstable
 * `PromptResponse`. Returns null when Pi reports no usable token numbers, so callers can
 * omit the field entirely instead of emitting zeros.
 */
export function sessionStatsToAcpUsage(stats: unknown): Usage | null {
  if (!stats || typeof stats !== 'object') return null

  const raw = stats as { tokens?: PiSessionStatsTokens | null; cost?: number | null }
  const tokens = raw.tokens
  if (!tokens || typeof tokens !== 'object') return null

  const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

  const inputTokens = num(tokens.input) ?? 0
  const outputTokens = num(tokens.output) ?? 0
  const totalTokens = num(tokens.total) ?? inputTokens + outputTokens
  if (totalTokens <= 0 && inputTokens <= 0 && outputTokens <= 0) return null

  const usage: Usage = {
    totalTokens,
    inputTokens,
    outputTokens
  }

  const cacheRead = num(tokens.cacheRead)
  const cacheWrite = num(tokens.cacheWrite)
  if (cacheRead !== undefined) usage.cachedReadTokens = cacheRead
  if (cacheWrite !== undefined) usage.cachedWriteTokens = cacheWrite

  const cost = num(raw.cost)
  if (cost !== undefined) usage._meta = { piAcp: { cost } }

  return usage
}

/** Races a promise against a timeout; rejects with an Error when the deadline passes. */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      err => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

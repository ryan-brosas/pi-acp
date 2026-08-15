export type JsonRpcId = number | string

export type JsonRpcNotification = {
  method: string
  params?: unknown
  id?: JsonRpcId
}

export type JsonRpcMessage = {
  jsonrpc?: string
  id?: JsonRpcId | null
  method?: string
  params?: unknown
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
}

export type PendingJsonRpcRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Settles a JSON-RPC response against the transport's pending request map.
 * Returns false (and leaves the map untouched) for notifications and for
 * ids with no pending entry, so callers can ignore unmatched frames.
 */
export function settlePendingJsonRpcResponse(
  message: JsonRpcMessage,
  pending: Map<string, PendingJsonRpcRequest>
): boolean {
  if (message.id === undefined || message.id === null) return false
  const key = String(message.id)
  const entry = pending.get(key)
  if (!entry) return false
  clearTimeout(entry.timer)
  pending.delete(key)
  if (message.error) {
    entry.reject(new Error(message.error.message ?? `MCP error ${message.error.code ?? 'unknown'}`))
  } else {
    entry.resolve(message.result)
  }
  return true
}

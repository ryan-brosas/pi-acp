export function normalizePiMessageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((c: unknown) => {
      const block = c as { type?: unknown; text?: unknown } | null
      const text = block?.type === 'text' ? block.text : undefined
      return typeof text === 'string' ? text : ''
    })
    .filter(Boolean)
    .join('')
}

export function normalizePiAssistantText(content: unknown): string {
  // Assistant content is typically an array of blocks; only replay text blocks for MVP.
  if (!Array.isArray(content)) return ''
  return content
    .map((c: unknown) => {
      const block = c as { type?: unknown; text?: unknown } | null
      const text = block?.type === 'text' ? block.text : undefined
      return typeof text === 'string' ? text : ''
    })
    .filter(Boolean)
    .join('')
}

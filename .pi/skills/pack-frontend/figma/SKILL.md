---
name: figma
description: Use when implementing UI from Figma designs, extracting design tokens, or downloading assets via Framelink MCP. MUST load when user shares a Figma URL or references Figma files. Requires API token.
disable-model-invocation: true
---

# Figma Design Data (MCP)

## When to Use

Fetching layout, styles, or assets from a Figma file via MCP. Required when user shares a Figma URL or references a Figma file.

## When NOT to Use

No Figma file key / node ID available; design data not required for the task.

## Prerequisites

```bash
export FIGMA_API_KEY="your-figma-personal-access-token"
```

Token: Figma → Account Settings → Personal Access Tokens. Scope: `File read` (and `Dev resources` for assets).

## Core Workflow

1. **Parse the URL.** Extract `file_key` and optional `node_id` from the Figma URL.
2. **Fetch the node data.** `GET /v1/files/{file_key}/nodes?ids={node_id}` for layout, styles, text.
3. **Fetch assets if needed.** `GET /v1/images/{file_key}?ids=...` for image exports (PNG, SVG, PDF).
4. **Extract tokens.** Build a token map: colors, typography, spacing from the file.
5. **Map to design system.** Convert Figma styles to your design tokens (see `design-taste-frontend`).
6. **Implement.** Use the tokens, not the raw Figma values.

## Common Operations

| Operation              | When                                        |
| ---------------------- | ------------------------------------------- |
| Get file metadata      | First step in any flow                      |
| Get specific node      | When you have a node ID from a URL          |
| Get image exports      | When you need assets (icons, illustrations) |
| Get styles / variables | Token extraction                            |

## Token Extraction

```ts
// Pseudo-pattern for extracting tokens
const tokens = {
  colors: extractColors(styles),
  typography: extractTypography(textStyles),
  spacing: extractSpacing(effects) // sometimes inferred from layout
}
```

Map to your design system (e.g., CSS variables, Tailwind config, design tokens package). Don't hardcode Figma values.

## Common Mistakes

Fetching the entire file when you need one node (token waste); not setting `FIGMA_API_KEY` first; hardcoding Figma values in code instead of using extracted tokens; missing rate limits (60 requests/min); not handling 404 (file moved, private); using wrong node ID format; downloading full-res when you needed thumbnail; not storing the extracted tokens (re-fetching every run).

## Red Flags

API key in code / logs; fetching whole file repeatedly; tokens hardcoded instead of in design system; no cache of extracted data; missing image format choice (always PNG?); ignoring rate limits; assuming token is public (it's not — needs scope); using stale data when design has changed.

## Anti-Patterns

**"Fetch the whole file"** (waste of tokens); **hardcoded Figma values** (defeats purpose of tokens); **no rate limit handling** (will 429); **one-shot fetch + implement** (no cache, repeated work); **manual transcription of design values** (error-prone, stale).

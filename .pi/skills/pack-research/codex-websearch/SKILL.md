---
name: codex-websearch
description: 'Use when you need current web facts, documentation discovery, or cited search results through the installed Codex web-search extension.'
disable-model-invocation: true
---

# Codex Web Search

Use the installed Pi Fabric extension `extensions.openai_websearch` for bounded
live-web discovery. It uses the host's OpenAI subscription authentication; it
does not require a project API key, package install, or browser automation.

## Workflow

1. Search with the user's information need stated plainly.
2. Set `responseLength` to `short` for discovery, `medium` for a compact
   evidence summary, or `long` only when synthesis needs more context.
3. Preserve the returned citations, access date, and exact query in the evidence
   ledger.
4. Prefer official, dated, versioned sources; treat search output as a
   shortlist or cited answer, not permission to invent an unsupported claim.
5. Stop at 3–5 useful results. Fetch or inspect only a selected URL with a
   separately discovered read-only capability; never invent a fetch action.

Example inside `fabric_exec`:

```ts
const result = await extensions.openai_websearch({
  query: "<the user's information need>",
  responseLength: 'short'
})
return result
```

## Boundaries

This is an optional host capability. Pi Fabric Schema `enforce` blocks captured
extensions and network providers, so report the capability gap and keep the
research read-only when the guard is active. Do not fall back to Brave API keys,
local npm dependencies, or obsolete provider names.

<skill_result>
<skill>codex-websearch</skill>
<status>success|partial|blocked|failure</status>
<evidence>Exact query, cited results, access date, and confidence</evidence>
<artifacts>Compact evidence ledger</artifacts>
<risks>Unavailable host extension, stale source, or none</risks>
</skill_result>

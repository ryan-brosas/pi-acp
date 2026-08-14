---
name: evidence-router
description: 'Use when choosing a bounded retrieval route for local code, inspiration repositories, GitHub overviews, library docs, or current web facts.'
disable-model-invocation: true
---

# Evidence Router

Pick one primary route per question, escalate only on a named gap, and stop
once evidence is sufficient. Keep tool names discoverable and current rather
than guessing a provider action.

## Routes

| Need                        | Tool                                                                 | Budget               |
| --------------------------- | -------------------------------------------------------------------- | -------------------- |
| Active-project code         | `extensions.fovea_sketch` → `extensions.fovea_focus`                 | bounded by query     |
| Inspiration discovery       | `cgc find content "<domain>" --context "<inspo-root>"`               | one meta query       |
| Inspiration repository      | `cgc find name/content ... --context "<inspo-root>/<repo>"`          | one repo per query   |
| GitHub repository overview  | `mcp.deepwiki.get-deepwiki-index` → `mcp.deepwiki.get-deepwiki-page` | one index + one page |
| Library or API docs         | `mcp.context7.resolve-library-id` → `mcp.context7.query-docs`        | max three topics     |
| Current facts and discovery | `extensions.openai_websearch`                                        | 3–5 cited results    |
| Selected page content       | a discovered read-only fetch/crawl capability                        | selected URLs only   |

## Escalation Order

1. Pi Fovea for active-project symbols, routes, and relationships.
2. CGC meta-context discovery, then one-repository-at-a-time CGC queries.
3. DeepWiki index/page for a bounded GitHub overview or when CGC is unavailable.
4. Context7 for current versioned library documentation; resolve the library ID
   first unless the user supplied `/org/project[/version]`.
5. Codex web search for current facts or discovery when the earlier routes do
   not answer the question.
6. A discovered read-only fetch/crawl tool for one already-selected URL.

Move one step only after a named gap: the Fovea graph lacks the symbol, the CGC
context is missing or stale, the DeepWiki index has no relevant page, Context7
lacks the version, or the cited shortlist lacks a primary source.

## Optional Veda synthesis

Use Veda's AGY Gemini profiles as a bounded, economical second read after the primary evidence route:

1. `repo-scout` with `gemini-lite` maps files, symbols, and gaps.
2. `context-curator` with `gemini-mid` compresses selected findings into a handoff packet.
3. `frontend-auditor` with `gemini-ui` checks UI states, responsive behavior, accessibility, and visual risks.
4. `cross-system-synthesizer` with `gemini-pro-low` resolves contradictions before a load-bearing plan.

Then invoke direct AGY Claude Opus for architecture planning or high-risk review. Veda Gemini passes are advisory, not evidence; preserve primary tool calls, source citations, and the evidence ledger. Do not invoke `veda -b agy -m claude-*`: the adapter injects `--effort`, which the AGY Claude models reject. If a lane is unavailable, continue with Pi-native evidence and report the gap.

## Evidence Validity

A GitHub repository is a lead, not automatically authoritative evidence. Capture
owner/repo, commit or branch, retrieval date, and license; verify important
claims against code, tests, and official documentation. A CGC clone is an
indexed navigation snapshot, not a truth store.

## Anti-Splurge Rules

- Deduplicate findings by question plus source.
- Summarize before expanding a source.
- Parallelize only independent angles.
- Cap each source as shown in the table.
- Stop when one primary source answers the question or two independent sources
  agree; otherwise report the open evidence gap.

## Evidence Record

For each finding record the claim, source tool, exact call, URL or context, date,
and confidence. Unknowns stay `[NEEDS CLARIFICATION: reason]`; no source, no
claim.

<skill_result>
<skill>evidence-router</skill>
<status>success|partial|blocked|failure</status>
<evidence>One primary route, named gaps, bounded calls, compact evidence records</evidence>
<artifacts>Routed evidence ledger</artifacts>
<risks>Duplicate retrieval, unbounded expansion, unavailable capability, or none</risks>
</skill_result>

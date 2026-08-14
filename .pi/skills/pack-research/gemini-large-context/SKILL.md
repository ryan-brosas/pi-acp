---
name: gemini-large-context
description: "Use when large-context repository research exceeds the local window; routes through budget-aware Veda AGY Gemini profiles, while direct AGY Claude is reserved for architecture planning and review."
disable-model-invocation: true
---

# Budget-Aware Large-Context Research via Veda/AGY

## Use when

Large, multi-file, or project-wide analysis exceeds the local context window: codebase-wide searches, multi-file comparisons, pattern discovery, feature verification across many files, or research that benefits from a second model.

## Host-adapted tiers

Use the smallest AGY Gemini tier that can answer the question:

- `gemini-lite` → `gemini-3.6-flash-low`: repository maps and cheap discovery.
- `gemini-mid` → `gemini-3.6-flash-medium`: context curation and follow-ups.
- `gemini-ui` → `gemini-3.6-flash-high`: frontend audits and UI-specific review.
- `gemini-pro-low` → `gemini-3.1-pro-low`: cross-system synthesis.
- `gemini-pro` → `gemini-3.1-pro-high`: only when the lower tiers leave a named gap.

These are host-local aliases. Confirm them with `veda models --json`; do not assume they exist on another machine.

## Workflow

1. Select a bounded file set with `veda sel add`; Veda does not automatically load `.pi/skills`.
2. Start with `gemini-lite` and `repo-scout`; escalate to `gemini-mid` or `gemini-ui`, then `gemini-pro-low` only on a named gap.
3. Use `context-curator` before any load-bearing architecture call and `frontend-auditor` for UI work.
4. Give the compact packet plus authoritative files to direct AGY Claude Opus for architecture planning when the decision is consequential; use direct AGY Sonnet for cheaper critique.
5. Capture long Veda output with `-o` to disposable `/tmp` storage, or persist to `.pi/work/` only through a Schema transaction.
6. Keep source paths, exact calls, dates, and confidence levels in the final evidence ledger.

```bash
veda -S <session> sel clear
veda -S <session> sel add <bounded-files>
veda -S <session> -m gemini-lite -p repo-scout 'Map selected files and cite gaps.'
veda -S <session> -m gemini-mid -p context-curator 'Compress selected findings into a handoff packet.'
```

## Red flags

Unscoped selections, jumping to `gemini-pro` without a named gap, asking Veda to edit files, treating synthesis as primary evidence, or routing AGY Claude through Veda while the adapter still injects `--effort`.

## Skill Result Contract

```xml
<skill_result>
  <skill>gemini-large-context</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Paths scoped, tier selected by need, output captured and synthesized</evidence>
  <artifacts>Budgeted research packet or synthesized findings</artifacts>
  <risks>Unscoped scan, unnecessary high-tier usage, authentication, rate limits, or none</risks>
</skill_result>
```
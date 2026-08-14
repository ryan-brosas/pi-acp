# Budget-Aware AGY Gemini — Operational Reference

Load this reference only after the `gemini-large-context` leaf matches. Use Veda for economical Gemini passes; use direct AGY for Claude planning and review.

## Tiered funnel

```bash
# Bounded selection; Veda does not automatically load .pi/skills.
veda -S <session> sel clear
veda -S <session> sel add .pi/work/<slug>/spec.md src/ components/ styles/ tests/
veda -S <session> sel ls

# Cheap map and curation.
veda -S <session> -m gemini-lite -p repo-scout 'Map selected files; cite paths, symbols, dependencies, and gaps.'
veda -S <session> -m gemini-mid -p context-curator 'Compress selected findings into a bounded packet; preserve contradictions and citations.'

# UI-specific pass.
veda -S <session> -m gemini-ui -p frontend-auditor 'Audit selected UI states, responsive behavior, accessibility, and design-system consistency.'

# Cross-system synthesis only when needed.
veda -S <session> -m gemini-pro-low -p cross-system-synthesizer 'Resolve contradictions and produce a decision packet for architecture planning.'
```

## Claude planning and review (direct AGY only)

Veda's AGY adapter currently injects `--effort`; AGY Claude rejects that option. Direct AGY calls succeeded for both Claude IDs without it:

```bash
# Architecture plan — reserve for consequential decisions.
agy --add-dir "$PWD" --model claude-opus-4-6-thinking --mode plan --print 'Read the selected files. Do not edit. Produce architecture, alternatives, non-goals, ordered stations, acceptance checks, risks, and handoff payload.'

# Cheaper critique — use before spending another Opus call.
agy --add-dir "$PWD" --model claude-sonnet-4-6 --mode plan --print 'Read the selected files and current diff. Do not edit. Report concrete architectural risks, missing checks, and scope drift.'
```

Do not use `veda -b agy -m claude-*` until the adapter conditionally omits `--effort`.

## Selection strategy

1. Start with full relevant files and run `veda sel ls`.
2. Keep selection bounded; use slices only when the selection is too large.
3. Include the active spec or plan when task-constrained.
4. Include authoritative docs, tests, and implementation files together when verifying a claim.
5. Pass the curator/synthesizer packet to direct AGY Claude; do not make Opus rediscover the whole repository.

## Output and persistence

```bash
veda -S <session> -m gemini-pro-low -o /tmp/gemini-research.md -p cross-system-synthesizer 'Synthesize the selected context and cite every finding.'
```

If findings belong in `.pi/work/<slug>/research.md`, use the repository Schema loop before writing. Do not use shell redirection or a Veda worker to bypass that boundary.

## Limits and escalation

- Start with `gemini-lite`; escalate only on a named evidence gap.
- Use `gemini-pro` only for unresolved cross-system ambiguity.
- Reserve Opus for architecture decisions and high-risk review; Sonnet is the cheaper critique.
- AGY exposes the model catalog but no reliable quota counter here; cap repeated calls and stop when the evidence contract is satisfied.

## Result contract

Return a compact report with the question, tier used, answer summary, findings, contradictions, open gaps, and an evidence ledger containing claim, exact tool call, source path/URL, date, and confidence.

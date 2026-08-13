---
name: planning-and-task-breakdown
description: Use when a feature/change has a spec or clear goal and needs an executable implementation plan.
disable-model-invocation: true
---


# Planning & Task Breakdown

## When to Use

- Have a spec, PRD, ADR, or clear feature goal.
- Implementation spans >1 file or >1 session.
- Need an executable plan the current session can follow.

## When NOT to Use

- Single-function fixes; mechanical refactors with obvious verification.
- No spec exists yet — use `brainstorming` first.
- Trivial one-liner with no acceptance criteria.
- Two or fewer stations — erasure applies: ship directly, the assembly would cost more than the work.
- Single-slice change — use `incremental-implementation` instead.

## Core Principle

**Lead with what is most-likely to change** (data model, type interfaces, UX). Mechanical refactor last. Stable parts of the plan go at the bottom; volatile parts at the top. If a section of the plan survives contact with implementation, it should be at the bottom.

## Workflow

1. **Spec interview** — ask the questions the spec leaves open (data model, edge cases, non-goals, success criteria). One question at a time for non-obvious decisions.
2. **Decompose** — break work into an ordered assembly line of stations. Each station is one complete path through the layers, independently verifiable.
3. **Order** — most-likely-to-change first, mechanical refactor last. Risk-first when integration is unknown.
4. **Checks + payloads** — per station, name the acceptance check, the risk of getting it wrong, and the handoff payload the next station must receive (files, key symbols, invariants, decisions).
5. **Stop conditions** — for parallel work, define who stops whom on conflict.

## Station Quality

| Good station | Bad station |
|---|---|
| One complete path through all layers | One layer in isolation |
| Independently verifiable (test/build/check passes) | Untestable until all stations done |
| Adds user-visible behavior or fixes a bug | Pure prep with no signal |
| Reverts cleanly | Tangles with unrelated code |

## Plan Template

The plan is an assembly line, not a design document. Each station carries its task, acceptance check, handoff payload, and risk:

```
## Goal
[1 sentence]

## Non-goals
[explicit exclusions]

## Stations (ordered)
### S1 - <title>
- task: [1 sentence]
- acceptance: [command or observable check]
- payload: [files, key symbols, invariants, decisions for S2]
- risk: [what breaks here]
### S2 - <title>
- ...

## Open questions
[must-resolve before station N]

## Stop conditions
[who blocks whom, on what]
```

## Acceptance Ledger

Record each station's outcome in `.pi/work/$(cat .pi/work/.active)/.progress.md`, keyed by station id: status, checks run (command + exit code), findings, rulings, payload passed on. The ledger is the plan's acceptance record; a station without a ledger entry has not happened.

## Red Flags

- Plan starts with "setup" / "scaffold" / "infrastructure" — that's horizontal, not vertical.
- Station acceptance is "looks right" instead of a concrete command.
- No explicit non-goals — scope will creep.
- Mechanical refactor (rename, reformat) appears in station 1 — moves the goalposts.
- Risks only listed at the end, not per station.
- Open questions outnumber stations — spec is incomplete, go back to brainstorming.

## Optional model funnel

For plans with three or more stations, reduce frontier usage before asking Claude to decide:

1. Run `repo-scout` on a bounded selection with `gemini-lite`.
2. Run `context-curator` with `gemini-mid`; add `frontend-auditor` with `gemini-ui` for UI work.
3. Run `cross-system-synthesizer` with `gemini-pro-low` when multiple subsystems conflict.
4. Give the resulting decision packet and authoritative files to direct AGY `claude-opus-4-6-thinking` with `--mode plan`; require architecture, alternatives, non-goals, stations, acceptance checks, risks, and handoff payloads.
5. Use direct AGY `claude-sonnet-4-6` for a cheaper critique; reserve a second Opus call for high-risk review only.
6. The Driver validates call sites, maintains the station ledger, and owns every Schema-gated mutation.

Do not route AGY Claude through Veda: its current adapter injects unsupported `--effort`. Do not delegate repository writes to a Veda worker by default or weaken the Schema guard (`schema.mode`: enforce or audit).

## Pi Fabric Boundaries

**Discovery** — Pi Fovea focus/impact before text search. **Mutation** — plan writes defer to the Schema mutation guard in AGENTS.md. **Execution** — stations run under `task-scoped-execution` with compaction between stations.

## Skill Result Contract

```xml
<skill_result>
  <skill>planning-and-task-breakdown</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Spec gaps filled, stations defined and ordered, acceptance checks and handoff payloads named</evidence>
  <artifacts>Plan document or section with station ledger</artifacts>
  <risks>Unresolved open questions, unverified stations, or none</risks>
</skill_result>
```

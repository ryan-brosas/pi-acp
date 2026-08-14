---
name: task-scoped-execution
description: Use when executing a plan with two or more ordered implementation stations, where each station needs acceptance review, a handoff payload, and bounded correction before the next begins.
disable-model-invocation: true
---

# Task-Scoped Execution

## Core Principle

One current-session executor runs each station as a compact package: acceptance review against its checks, a ledger entry, context compaction, and a handoff payload to the next station. Correction is bounded to at most two scoped rounds. Agents and subagents are unsupported on this stack: never dispatch one and never simulate delegation.

## When to Use

- Two or more ordered stations; each has acceptance criteria, a known file set, and a payload for the next; later stations depend on earlier outcomes.

## When NOT to Use

- Single-station work: use `incremental-implementation` (erasure).
- No plan yet: use `planning-and-task-breakdown` first.
- Trivial one or two small edits: the `trivial: true` disposition is the erasure.
- Review-only pass: use `code-review-and-quality`.

## The Station Package

State each field first:

- station id: S<n> from the plan
- task text: one sentence of intent
- acceptance checks: commands or observable behavior
- handoff payload: files, key symbols, invariants, decisions for the next station
- permitted files
- verification command: the smallest passing check

## The Loop

1. **Package** - write the station package from the plan; never start without a concrete acceptance check.
2. **Implement** - direct edits in this session. Smallest change that passes the check; follow `test-driven-development`. Serialize mutations; parallelize read-only discovery.
3. **Acceptance review** - run every acceptance check, record command and output tail. No evidence, no completion.
4. **Quality review** - read the diff as a new teammate would: intent, edge cases, naming, consistency, dead code. Tag findings blocker, minor, or note.
5. **Correct (max two rounds)** - address findings with scoped edits; re-review only the original findings and the correction diff. New observations are ledger notes, not reopeners.
6. **Ledger** - append status, checks, findings, payload passed on; key by station id. Update the todo list.
7. **Compact** - request programmatic compaction (`compact.request`) where supported; the next station starts from compacted context plus its payload.
8. **Next station** - proceed in dependency order. Re-run the combined check when two stations share a seam.

## Ledger Entry Format

```text
### <date> station S<n> - <title>
status: done | blocked | note
checks: <cmd> exit <code>
findings: <blocker|minor|note> <what>
payload passed to: S<n+1>
```

The ledger IS the plan's acceptance record; a station without an entry has not happened.

## Stop Conditions

- BLOCKED: an acceptance check fails twice on the same approach, or a load-bearing finding survives the cap.
- A plan conflict the executor cannot resolve.
- Destructive action or genuine ambiguity: ask, do not guess.
- All stations complete. After the last, review the diff for integration breaks, duplicated seams, spec drift; `verification-before-completion` and `shipping-and-launch` take over.

## Red Flags

Simulated delegation; per-station commit churn; acceptance by inspection; unbounded correction rounds; silent finding discard; parallel edits; starting without a package; a payload that re-derives the ledger.

## Common Rationalizations

| Rationalization | Rebuttal |
| --- | --- |
| "It works, skip the acceptance run" | Unrun checks are claims, not evidence. |
| "One more round will converge" | Past the cap, rounds stop converging. Adjudicate. |
| "I can fake a subagent call" | Delegation is unsupported; the executor is this session. |

## Skill Result Contract

```xml
<skill_result>
  <skill>task-scoped-execution</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Per-station acceptance runs and ledger entries</evidence>
  <artifacts>Station ledger, final whole-change review notes</artifacts>
  <risks>Unresolved load-bearing finding, missing acceptance evidence, or none</risks>
</skill_result>
```

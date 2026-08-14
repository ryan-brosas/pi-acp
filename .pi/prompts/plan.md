---
description: Create an advisory assembly-line implementation plan with stations
argument-hint: ''
---

# Plan

Create an advisory assembly-line plan: an ordered list of stations, each with an acceptance check and a handoff payload for the next station. The plan is quick to produce; the assembly (station packages, compaction, acceptance ledger) carries the quality.

> **Workflow:** `/create` → **`/plan`** (optional) → `/ship`
> **When to use:** complex tasks where spec verification steps aren't enough guidance. Skip for simple tasks.

## Erasure: When NOT to Plan

Planning machinery erases itself for smaller scoped work; otherwise the scope discipline of the assembly over-applies.

- **Trivial (1-2 small edits)** — skip planning entirely; the mutation guard's `trivial: true` disposition is the erasure.
- **Two or fewer stations** — skip `/plan`; ship directly from the spec. The assembly would cost more than the work.
- **Single-slice change** — use `incremental-implementation` instead.
- Only plan when the work genuinely splits into 3+ ordered stations with distinct acceptance checks.

## The Assembly Pattern

The plan is an assembly line, not a design document. Each station is a unit of work that an executor frame runs with a compact context. The executor carries three things from station to station:

1. **Handoff payload** — the compact summary of what came before (files, key symbols, invariants, decisions) that the next station must know. Hold it in `carry` (session-persistent guest state) for the next station; the plan file and `.progress.md` ledger remain the durable record.
2. **Acceptance ledger** — the running record of checks run and outcomes per station, in `.pi/work/$(cat .pi/work/.active)/.progress.md`, keyed by station id.
3. **Compaction** — after each station's ledger entry, request programmatic compaction (`compact.request`) where the host supports it, so the next station starts from the compacted context plus its payload.

Plans are advisory, not directive: the executor uses the plan as a starting point, then does independent investigation before each station.

## Phase 0: Institutional Research (Trimmed)

Load only enough codebase knowledge to name stations correctly. Do not research exhaustively; the assembly carries discovery forward per station.

1. **Project context** — `rg -n "topic" .pi/MEMORY.md`; `git log --oneline -20` for conventions and footgun zones.
2. **Code reconnaissance** — Pi Fovea focus for relevant symbols/config keys; Pi Fovea impact on key functions; read 2-4 representative files (including tests) so station boundaries match existing structure.
3. **Stop when you can name the stations.** Research beyond that is scope discipline without a station to attach it to.

## Phase 1: Guards

Verify:

- `.pi/work/$(cat .pi/work/.active)/spec.md` exists (if not, tell the user to run `/create` first)
- If `.pi/work/$(cat .pi/work/.active)/plan.md` already exists, ask the user: overwrite or skip?

## Phase 2: Station Decomposition

Break the goal into an ordered assembly line. Order by what is most likely to change (data model, type interfaces, UX) first; mechanical refactor last.

### Station Attributes

Each station (S1..Sn) has exactly:

- **task** — one sentence of intent
- **acceptance check** — command or observable behavior that proves the station done
- **handoff payload** — files, key symbols, invariants, and decisions the next station must know
- **risk** — what is most likely to break here

### Derivation Guide

- **Goal-backward:** from the PRD success criteria, derive "what must be TRUE for the goal" (outcome-shaped), then "what must EXIST" per truth (artifact = file/component/API).
- **Key links:** "where is this most likely to break?" — record as the station's risk.
- **Dependency order:** `needs` / `creates` per station; later stations depend on earlier outcomes.

### Station Quality

| Good station                                                   | Bad station                                                |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| One complete path through the layers; independently verifiable | One layer in isolation; untestable until all stations done |
| Adds user-visible behavior or fixes a bug                      | Pure prep with no signal                                   |
| Has a concrete acceptance check                                | Acceptance is "looks right"                                |
| Ships a handoff payload the next station can run on            | Leaves the next station to re-derive context               |

## Phase 3: Write the Plan (output contract)

When the work warrants it, render companion artifacts from their templates into `.pi/work/$(cat .pi/work/.active)/` before writing plan.md:

- `proposal.md` from `.pi/templates/proposal.md` — why this work, what changes, capabilities, impact
- `design.md` from `.pi/templates/design.md` — architecture, data flow, error handling (ship reads this artifact)
- `adr.md` from `.pi/templates/adr.md` — one record per architecture decision made during planning

Skip any companion the work does not need; plan.md remains the station contract.

Write `.pi/work/$(cat .pi/work/.active)/plan.md` in this assembly-line format:

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

Every station's outcome is recorded, keyed by station id, in `.pi/work/$(cat .pi/work/.active)/.progress.md` as the assembly executes:

```text
### <date> station S1 - <title>
status: done | blocked | note
checks: <command> exit <code>
findings: <blocker|minor|note> <what>
payload passed to: S2
```

The ledger IS the plan's acceptance record. A station without a ledger entry has not happened.

## Schema boundary

Research and planning are read-only. Before writing the plan file, run the
Schema loop inside one `fabric_exec`: `schema.hypothesize` (evidence:
`file_contains`/`file_sha256` literals or the `canonical-check` trusted
command) → `schema.verify` → `schema.commit` with declared operations and
nonempty postconditions. Only `committed` authorizes the write; then write in
the same `fabric_exec`. Mark completed steps `[DONE:n]`. If verification fails
or scope changes, do not mutate. After verification, record the gate decision (passed/disposition; evidence kinds: command, artifact, trace, custom) with the session's workflow recorder when available, or carry it in the completion report.

**Dual mode.** Read-only discovery is identical in both modes; only mutation
authorization differs. Schema mode (`schema.status().mode === "enforce"`):
the loop above applies. Main-session mode (guard off or project untrusted):
propose each mutation to the user and apply only after explicit approval of the
exact action and files. Detect at the mutation boundary: `schema.status()`
reports `enforce` → Schema mode; otherwise → main-session mode.

## Related Commands

| Need                  | Command   |
| --------------------- | --------- |
| Create the spec first | `/create` |
| Implement the plan    | `/ship`   |
| Verify gates          | `/verify` |

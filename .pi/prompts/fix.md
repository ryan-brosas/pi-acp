---
description: Debug and fix a bug or failing test
argument-hint: '<description of bug or error>'
---

# Fix: $ARGUMENTS

Systematically debug and fix the reported issue.

## Load Skills

Load the skill at `.pi/skills/pack-quality/root-cause-tracing/SKILL.md`, then
`.pi/skills/verification-before-completion/SKILL.md`.

## Process

### Phase 1: Reproduce

Reproduce the issue with the exact steps or command given by the user. If the user gave no repro, build one from the report (error message, failing test, screenshot, log).

### Phase 2: Symptom Inventory

Before proposing a root cause, list every symptom the report and repro show:

- What fails, what still works?
- When did it start (recent change? always?)
- What inputs trigger it; what inputs do not?
- Any error text, stack, exit code?

A valid root-cause theory must explain all of these. If a theory explains one symptom but contradicts another, drop it.

### Phase 3: Trace to Root Cause

- Search for the error message or symptom in the codebase (`rg -n`, Pi Fovea focus).
- Trace the execution path: entry point → handling → failing call, reading the 2-4 most relevant files.
- Read the callers and callees of the suspicious function; the bug is often in the boundary between components.
- Distinguish symptom from root cause: the error message is where it manifests, not necessarily where the bug lives.

### Phase 4: Fix (smallest root-cause fix)

- Apply the minimal fix for the root cause.
- Do not add speculative guards, tolerant readers, or defensive copies.
- Prefer making the bad state impossible over handling all bad states.
- If the fix requires touching multiple files, keep them in one focused change set.

### Phase 5: Regression Test

- Write a failing test that reproduces the bug (unit or integration, matching project conventions).
- Confirm it fails before the fix and passes after.

### Phase 6: Verify

Run the smallest relevant checks that exist: typecheck, lint, the failing test module, and any neighboring tests.

**Failure handling:** if verification fails twice on the same approach, stop and
escalate with what was learned — do not iterate blindly.

## Schema boundary

Discovery and reproduction are read-only. Before editing any file, run the
Schema loop inside one `fabric_exec`: `schema.hypothesize` (evidence:
`file_contains`/`file_sha256` literals or the `canonical-check` trusted
command) → `schema.verify` → `schema.commit` with declared operations and
nonempty postconditions. Only `committed` authorizes the edit; then apply the
fix in the same `fabric_exec`. Mark completed steps `[DONE:n]`. If
verification fails or scope changes, do not mutate. After verification, record the gate decision (passed/disposition; evidence kinds: command, artifact, trace, custom) with the session's workflow recorder when available, or carry it in the completion report.

**Dual mode.** Read-only discovery is identical in both modes; only mutation authorization differs. Schema mode (`schema.status().mode === "enforce"`): the loop above applies. Main-session mode (guard off or project untrusted): propose each mutation to the user and apply only after explicit approval of the exact action and files. Detect at the mutation boundary: `schema.status()` reports `enforce` → Schema mode; otherwise → main-session mode.

## Output

Report:

1. Root cause (with file:line)
2. Symptoms explained by the theory
3. Fix applied (diff summary)
4. Regression test result (fails before, passes after)
5. Verification results (typecheck/lint/test output tails)
6. What else was considered and rejected

## Related Commands

| Need             | Command     |
| ---------------- | ----------- |
| Verify gates     | `/verify`   |
| Audit a pattern  | `/audit`    |
| Research a topic | `/research` |

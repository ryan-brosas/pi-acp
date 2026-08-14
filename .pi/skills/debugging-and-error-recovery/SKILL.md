---
name: debugging-and-error-recovery
description: 'Use when tests fail, builds break, behavior is unexpected, or multiple fix attempts have not worked.'
---

# Debugging & Error Recovery

## Core Principle

Reproduce, localize, reduce, fix, and guard before claiming resolution. Random fixes create new bugs; move from symptom to root cause to guarded fix.

## When to Use

Test, lint, typecheck, build, or runtime failure; user-reported bug or unexpected behavior; a previous fix failed; error crosses multiple layers.

## When NOT to Use

Feature work with no failure signal (`incremental-implementation`); pure research (`source-driven-development`).

## Workflow

1. Read the full error and relevant logs.
2. Reproduce the failure or state why it cannot be reproduced.
3. Localize the failing layer: input, boundary, business logic, integration, environment.
4. Reduce to the smallest failing case.
5. Form one hypothesis; test it with one change or one diagnostic.
6. Write a failing regression test when behavior can be tested.
7. Fix the root cause, not only the symptom.
8. Re-run the original reproduction and relevant regression checks.

## Retry Policy

Try once with the same tool, then a fallback approach. After 2 consecutive failures, stop and escalate. After three failed fixes, the model is wrong — rethink architecture or assumptions. Before retrying, run a map-vs-territory check: re-read the request and any notes. Most repeated failures are a mapping problem, not an execution problem.

## Evidence Log

For complex bugs, keep a short log: Symptoms / Reproduction / Hypotheses Eliminated / Root Cause / Fix and Guard.

## Common Rationalizations

| Rationalization             | Rebuttal                                |
| --------------------------- | --------------------------------------- |
| "Probably the issue"        | Probably is a hypothesis, not evidence. |
| "Patch the symptom now"     | Symptom patches hide root causes.       |
| "Multiple fixes save time"  | You won't know which change mattered.   |
| "Test failure is unrelated" | Prove it with isolation first.          |
| "One more attempt"          | After three failures, stop and rethink. |

## Red Flags

Code changes before reproduction; fix before reading the full error; same failure persists after two attempts; new failures in different layers; regression test skipped for a reproducible bug; success claimed without re-running the original failing scenario.

## Verification

Original failure reproduced or documented as non-reproducible; root cause stated with evidence; regression test or guard exists when feasible; original scenario and related checks pass.

## Skill Result Contract

```xml
<skill_result>
  <skill>debugging-and-error-recovery</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Reproduction, root cause, fix, and verification commands</evidence>
  <artifacts>Changed files, tests, debug notes</artifacts>
  <risks>Non-reproducible behavior, missing regression test, or none</risks>
</skill_result>
```

---
name: shipping-and-launch
description: Use when preparing to merge, deploy, release, or declare a development branch complete.
disable-model-invocation: true
---


# Shipping & Launch

## Overview

Shipping should be boring because risk was removed earlier. The ship phase verifies readiness, documents what changed, and makes rollback possible.

Core principle: do not ship work that cannot be verified, explained, or rolled back.

## When to Use

- User says ship, merge, deploy, release, or finish.
- Before closing tracked work as complete.
- Before creating a PR or release notes.
- After build/review/QA phases pass.

## When NOT to Use

- Work is still being implemented.
- Critical review findings are open.
- Verification cannot run and no user-approved exception exists.

## Workflow

1. Check worktree state and identify intended changes.
2. Confirm spec/plan acceptance criteria are met.
3. Run required verification or use a fresh valid verification stamp.
4. Run phantom completion checks for stubs, placeholders, and disconnected wiring.
5. Review security/secrets/configuration risk in the diff.
6. Confirm docs/ADRs/changelog updates are sufficient.
7. Define rollback path: revert commit, feature flag, migration rollback, or manual procedure.
8. Present ship options when action is irreversible: PR, merge, deploy, hold.
9. Record handoff/memory when useful.

## Pre-Ship Checklist

- Tests relevant to changed behavior pass.
- Build/typecheck/lint pass or exceptions are documented.
- No high-severity review findings remain.
- No secrets or local-only paths in diff.
- User-facing/API behavior is documented.
- Rollback path is clear.
- User approval exists for irreversible actions.

## Common Rationalizations

| Rationalization | Rebuttal |
| --- | --- |
| "Tests passed earlier" | Fresh changes require fresh evidence or a valid unchanged-state stamp. |
| "Rollback is just git revert" | Migrations, flags, queues, and external state may need more. |
| "Docs can wait" | Shipped behavior without docs becomes support debt. |
| "Small release, no checklist" | Small releases still leak secrets and break config. |

## Red Flags

- Completion claim without verification evidence.
- Unresolved P0/P1 findings.
- No rollback plan for data or API changes.
- Changelog omits user-visible behavior changes.
- Deployment/merge attempted without explicit user approval.
- Placeholder/stub patterns remain in modified code.

## Verification

- Verification commands and outputs are recorded.
- Acceptance criteria are checked line-by-line.
- Phantom completion scan is clean or exceptions are explained.
- Rollback plan is documented.
- Final action is approved when irreversible.

## Skill Result Contract

```xml
<skill_result>
  <skill>shipping-and-launch</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Verification commands, acceptance audit, review status, rollback plan</evidence>
  <artifacts>Changelog, PR, release notes, handoff, or none</artifacts>
  <risks>Open findings, skipped checks, deployment risk, or none</risks>
</skill_result>
```


## Consolidated Branch Completion

`finishing-a-development-branch` was removed as a separate optional skill. Keep merge/PR/cleanup choices, release handoff, rollback planning, and completion evidence in this canonical shipping workflow.

## Pi Fabric Boundaries

**Verification** — cite direct behavioral probes and recorded outputs. Any fix defers to the Schema mutation guard in AGENTS.md.

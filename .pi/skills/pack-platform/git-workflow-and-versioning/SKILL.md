---
name: git-workflow-and-versioning
description: "Use when making code changes that need safe git hygiene, atomic commits, branch strategy, versioning, changelog entries, or release preparation - trunk-based development, commit-as-save-point discipline."
disable-model-invocation: true
---


# Git Workflow and Versioning

## Overview

Git workflow keeps changes reviewable, reversible, and shippable. Treat commits as verified save points, not dumping grounds.

## When to Use

- Any meaningful code change that may be committed, reviewed, or shipped.
- Creating or finishing a feature branch.
- Preparing release notes, version bumps, or changelog entries.
- Splitting a large diff into safe review units.
- Working in a dirty worktree where unrelated user changes may exist.

## When NOT to Use

- Read-only investigation with no file changes.
- Throwaway local experiments that will be discarded before reporting.

## Process

1. Inspect worktree state before editing: `git status --short`.
2. Identify unrelated changes and leave them untouched.
3. Keep each change atomic: one intent, one reviewable diff, one verification story.
4. Prefer trunk-based flow: short-lived branches, small PRs, frequent integration.
5. Use commits as save points only after verification passes or after clearly labeling partial work.
6. Scope staging to your files only; never use `git add .` in a mixed worktree.
7. For versioning, update the smallest required surface: package version, changelog, migration note, release tag, or docs.
8. Before shipping, confirm status, diff summary, verification evidence, and rollback path.

## Common Rationalizations

| Rationalization | Rebuttal |
| --- | --- |
| "I'll clean up the commit later." | Later cleanup often loses intent. Keep the diff clean while it is fresh. |
| "This unrelated formatting is harmless." | It increases review noise and can hide real regressions. |
| "One big commit is faster." | Small verified commits are easier to review, revert, bisect, and ship. |
| "The worktree was already dirty." | Dirty worktrees require more discipline, not less. |

## Red Flags

- Staging broad paths without reviewing the diff.
- Mixing feature work, refactors, formatting, and dependency updates.
- Committing generated or cache files unintentionally.
- Version bump without changelog or release rationale.
- Claiming clean worktree without checking status.

## Verification

Before declaring git workflow complete, provide:

- `git status --short` summary.
- Diff or staged-file summary for touched files.
- Verification commands and outcomes.
- Commit/version/changelog action taken, or explicit reason none was needed.

## Skill Result Contract

```xml
<skill_result>
  <skill>git-workflow-and-versioning</skill>
  <status>completed|blocked|skipped</status>
  <artifacts>Branch, commit, changelog, version file, or none</artifacts>
  <evidence>git status/diff summary and verification commands</evidence>
  <risks>Unrelated worktree changes, uncommitted files, release risk, or none</risks>
</skill_result>
```

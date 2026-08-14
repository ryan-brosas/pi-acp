---
name: agent-code-quality-gate
description: 'Use when a coding agent claims implementation work is complete - an operational gate over scope, duplication, behavior tests, verification evidence, and regressions.'
disable-model-invocation: true
---

# Agent Code Quality Gate

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Code-changed-this-session → review required.** Not optional.
- **Scope = diff scope.** Unrelated cleanup in the diff = wrong diff.
- **Behavior tests = required.** No "trust me, it works."
- **Duplication check = required.** AI agents duplicate by reflex.
- **Verification evidence = required.** Agent ran the check, pastes output, human reviews.
</EXTREMELY-IMPORTANT>

## When to Use

Before declaring "done" after bugfix, feature edit, refactor, or subagent work. The agent's work passes through this gate before the user reviews.

## The Gate (5 Checks)

1. **Scope.** Does the diff match the stated problem? Anything outside → split or revert.
2. **Duplication.** Copy-paste instead of reusing? New file with high overlap? Flag for refactor.
3. **Behavior tests.** For new behavior: a test. For bug fixes: a regression test. For refactors: existing tests still pass.
4. **Verification evidence.** Named check ran, exit 0, output captured. Not "should work".
5. **Regressions.** No new failures, no removed tests, no skipped tests.

## Workflow

1. **Get the diff.** `git diff` (or staged, or branch vs main).
2. **Scope check.** Is every line traceable to the stated problem?
3. **Duplication check.** Scan for repeated blocks. Flag or fix.
4. **Test check.** New code has tests. Bug fix has regression test. Refactor: green tests.
5. **Verification check.** Named command run, output captured.
6. **Regression check.** No new failures, no skipped tests.
7. **Pass / fail.** If any check fails, work is not done.

## Common Findings

| Finding                    | Action                   |
| -------------------------- | ------------------------ |
| "While I'm here" cleanup   | Split or revert          |
| Copy-pasted helper         | Extract to common module |
| New test that doesn't test | Rewrite or delete        |
| Skipped test (`.skip`)     | Un-skip or fix           |
| Removed test               | Add back, or justify     |
| No regression test         | Add one                  |
| Output truncated           | Show full output         |

## Severity Tells

| Tell           | Action                        |
| -------------- | ----------------------------- |
| `[blocker]`    | Must fix. Violated invariant. |
| `[should-fix]` | Worth fixing now. Real cost.  |
| `[nit]`        | Cosmetic. Note, don't block.  |
| `[question]`   | Need clarification.           |

## When to Override

| Override                     | When                                    |
| ---------------------------- | --------------------------------------- |
| "Scope creep is acceptable"  | User explicitly approved the extra work |
| "Duplication is acceptable"  | One-time use, extraction premature      |
| "Skipped test is acceptable" | Flaky, in test-quarantine               |
| "Removed test is acceptable" | Replaced by a better test               |

Document the override in the commit. Don't hide it.

## Common Mistakes

Skipping the gate; "I checked, it's fine" (no evidence); scope creep unmarked; tests that don't test; "I'll add tests later"; blockers downgraded to nits.

## Red Flags

"Should work" (run); "I tested it" (show run); truncated output; "tests later"; .skip on new; removed unmarked; "while I'm here" unmarked; scope creep unmarked.

## Anti-Patterns

**"I checked"** (no evidence); **"should work"**; **truncated output**; **"tests later"**; **.skip on new**; **removed unmarked**; **"while I'm here" unmarked**; **blockers unmarked**.

---
name: verification-before-completion
description: "Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always."
---

# Verification Before Completion

## The Iron Law

<EXTREMELY-IMPORTANT>
**No completion claim without evidence.** "Done" = the named verification command ran, exited 0, output inspected. Not "should work", "looks right", "tested locally". **Evidence before assertion, always.**
</EXTREMELY-IMPORTANT>

## Why It Exists

The most common failure mode is the unverified "done" claim: plausible code that never runs, caught later by a human, CI, or the next user. A claim escapes only with a verification artifact.

## When to Use

Before any "done", "fixed", "passing", "works", or "ready to merge" claim; before commit, push, or PR; after non-trivial edits.

## When NOT to Use

Pure prose changes (review the diff); claims backed by a directly observable artifact (cite file + lines).

## Verification Hierarchy

| Claim | Required evidence |
| --- | --- |
| "Test passes" | Test runner output, exit 0 |
| "Typecheck clean" | `tsc --noEmit`, exit 0 |
| "Lint clean" | Linter output, exit 0 |
| "Build succeeds" | Build output, exit 0 |
| "Behavior is X" | Repro + observed output |
| "Code matches spec" | Diff or path + line range |
| "Bug is fixed" | Regression test fails without, passes with |
| "Shipped" | All + commit / PR link |
| "IDE inspections clean" | `lint_files`/`get_file_problems` output for changed files, no errors |
| "Independent review passes" | Reviewer report with no unresolved P0/P1 findings |

Lower levels (prose, code review) are inspection, not verification.

## Workflow

1. **Name the check(s)** *before* editing.
2. **Run the check** — paste the output or its relevant tail. Truncate, don't paraphrase.
3. **Inspect the exit code** — 0 is green; non-zero means the claim is false.
4. **Inspect the output** — "0 tests run", "all skipped", "compiled with warnings" are not passes.
5. **If a check fails** — work is not done. Fix or surface the failure.
6. **Cite the artifact** — path, line range, SHA, or command + output. A claim without citation is an aspiration.

## Common Rationalizations

| Rationalization | Counter |
| --- | --- |
| "One-line change" | They break builds. |
| "Tested in my head" | Mental model ≠ code. |
| "Add tests later" | There is no later. |
| "CI will catch it" | That's the failure mode. |

## Red Flags

"It should work" (run it); "I've tested it" (show the run); "tests pass" (paste output, count); LGTM without a verification run; "made the changes" (show diff); truncating output that hides an error.

## Completion Pattern

```
<skill_result>
  <skill>verification-before-completion</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>
    - <command>: <exit code>, <output tail>
    - <test name>: <runner output>
  </evidence>
  <artifacts>Paths or SHAs touched</artifacts>
  <risks>Untested paths, missing guard, or none</risks>
</skill_result>
```

If `<evidence>` is empty, the claim is unverified. **Do not say "done".**

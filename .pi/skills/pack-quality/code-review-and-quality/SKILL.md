---
name: code-review-and-quality
description: "Use when reviewing code or PRs before merge, after subagent work, or when a review is requested. Bloat Review mode hunts over-engineering only, with a delete-list and tagged findings."
disable-model-invocation: true
---


# Code Review & Quality

## Core Principle

**Bloat is the default failure mode.** Code grows; review subtracts. The goal is a tight, minimal change that solves the stated problem — nothing more. A review that lists nits without identifying deletion candidates has missed the point.

## Two Review Modes

### 1. Standard Review

Before merge. Findings tagged `[blocker]`, `[should-fix]`, `[nit]`, `[question]`. For `[blocker]`, name the violated invariant and the smallest fix. For `[should-fix]`, name why it matters and the cost of leaving it.

### 2. Bloat Review

For AI-generated code, after a refactor, or when scope may have crept. Output a **delete-list** tagged `[delete]`, `[simplify]`, `[keep-with-reason]`. Default for any line that does not serve the stated problem is `[delete]`.

## Workflow

1. **Scope check** — diff match stated problem? Outside is `[blocker]` (split) or `[delete]`.
2. **Iron-law scan** — domain-relevant iron law followed? (TDD: failing test first. Effect: typed errors. UI: design taste. Performance: profile first.)
3. **Read for deletion** — "If I delete this, what breaks?" If nothing, it's bloat.
4. **Verify behavior** — test pass? Path exercised? `[question]` if unsure.
5. **Mark dead** — unused exports, dead branches, ownerless TODOs, restating comments.
6. **Verify in one pass** — typecheck + lint + relevant test.

## Delete-List Categories

| Tag | Meaning | Action |
| --- | --- | --- |
| `[delete]` | Unused / dead / speculative | Remove |
| `[simplify]` | Works but over-engineered | Reduce |
| `[keep-with-reason]` | Looks bloat, is load-bearing | Justify, or move to `[delete]` |

## Iron Laws by Domain

| Domain | Iron law |
| --- | --- |
| Any feature / bugfix | Failing test first (`test-driven-development`) |
| TS / JS with Effect | Typed errors, no `any` (`typescript-coding-standards`) |
| React / Next.js | Server components, bundle discipline (`react-best-practices`) |
| UI | Match form to failure (`writing-skills`); design-taste layer |
| Performance | Measure before optimizing (`performance-optimization`) |
| Security | Validate at every layer (`defense-in-depth`) |

## Red Flags (Bloat)

Abstraction with one call site; wrapper that does nothing; restating comment; helper "for future use" with no caller; generic name (`helper`, `util`, `manager`) hiding intent; feature flag never toggled; "might need this" branches; AI-shaped comments; `as any` casts; tests that mock the behavior they claim to test.

## Anti-Patterns

LGTM-by-default (review passes when nothing flagged); style nits as review (run the linter); scope creep (fixing unrelated issues — note `[NOTICED BUT NOT TOUCHING]`, don't fix); approving-vibes review ("looks good" without evidence — cite test runs, paths, lines).

## Self-Quiz

Did I find at least one `[delete]` / `[simplify]`? (If not, the review was shallow.) Are all `[blocker]`s named with the violated invariant? Did I run the verification command and see it pass? Are unrelated fixes `[NOTICED BUT NOT TOUCHING]`, not silently merged?

## Skill Result Contract

```
<skill_result>
  <skill>code-review-and-quality</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Tagged findings, verification run, delete-list (Bloat)</evidence>
  <artifacts>Review with tagged findings</artifacts>
  <risks>Untested claims, scope creep, LGTM-by-default, none</risks>
</skill_result>
```

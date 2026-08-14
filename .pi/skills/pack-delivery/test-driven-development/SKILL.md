---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code - write the test first, watch it fail, write minimal code to pass; ensures tests actually verify behavior by requiring failure first
disable-model-invocation: true
---

# Test-Driven Development

## The Iron Law

<HARD-GATE>
**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.** No exceptions for "obvious" code, "trivial" fixes, "I just need to see if this works first", or "I'll add tests later." The failing test is the design conversation. If you wrote code before the test, you don't know what you built.
</HARD-GATE>

## When to Use

Before any feature implementation, bug fix, or refactor that changes behavior. REQUIRED BACKGROUND for `incremental-implementation`, `code-review-and-quality`, and any feature work.

## When NOT to Use

Documentation-only changes; pure configuration; throwaway prototypes explicitly marked as such.

## The Loop

```
RED:      write a failing test that captures the requirement
GREEN:    write the minimum code to make it pass
REFACTOR: improve the code while keeping tests green
```

Each cycle is small (minutes, not hours). Do not stack multiple steps before running the test.

## What a Test Is

A test asserts **observable behavior**: input → output, state change, side effect, or error contract. A test does **not** assert implementation details (private state, internal call order, mock interaction count) or that a specific function was called.

If your test breaks on refactor without behavior change, you wrote an implementation test. Rewrite as a behavior test.

## The RED Step

The test must fail for the **right reason** — the behavior is missing, not the test is broken. A test that doesn't compile is not RED. A test that passes on first run is not testing anything. Stop and rewrite.

## Common Rationalizations

| Rationalization           | Counter                                    |
| ------------------------- | ------------------------------------------ |
| "It's obvious"            | If trivial, RED is trivial. Write it.      |
| "Tests after"             | There is no after.                         |
| "One-line change"         | One-liners break builds. Test takes 30s.   |
| "API stabilizes first"    | Test IS the API design.                    |
| "Tested manually"         | Not reproducible, not automatable.         |
| "Mocking is faster"       | Mocks test your assumptions, not behavior. |
| "Existing tests cover it" | Run them. Cite the output.                 |

## Workflow

1. **Read the requirement** — user-observable behavior + success criterion.
2. **Write failing test** — smallest capturing the behavior. Run. Confirm RED.
3. **Minimum code** — smallest change to pass. No "while I'm here" extras.
4. **Run** — confirm GREEN. If fails, debug — don't change the test.
5. **Refactor** — names, structure, duplication. No new behavior. Tests stay green.
6. **Verify** — full test file, not just the new test.

## Self-Quiz

Did I see RED for the right reason? Minimum code (no extras)? Refactor preserved behavior? Full test file green? If I skipped ("obvious"), what test would make it testable?

## Red Flags

Test passes on first run; test asserts implementation details; test breaks on refactor without behavior change; "I'll add tests later"; "obvious code" without test; "manual testing"; mocking the behavior claimed.

## Pi Fabric Boundaries

Tests are direct behavioral probes (black-box first); mutation defers to the Schema mutation guard in AGENTS.md.

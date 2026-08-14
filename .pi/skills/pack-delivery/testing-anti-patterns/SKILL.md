---
name: testing-anti-patterns
description: Use when writing or changing tests, adding mocks, or tempted to add test-only methods to production code - prevents testing mock behavior, production pollution with test-only methods, and mocking without understanding dependencies
disable-model-invocation: true
---

# Testing Anti-Patterns

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Test behavior, not mocks.** Asserting the mock was called tests the mock, not your code.
- **No test-only methods in production.** If a method exists only for tests, the design is wrong.
- **Mock at the seam.** Mock the interface, not the internals.
- **One intent per test.**
- **Tests must fail for the right reason.** A test that catches a typo is a tautology.
</EXTREMELY-IMPORTANT>

## Test Modes

| Mode                    | Use when                                                | Bound                                                          |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| **Black-box** (default) | Public APIs, CLI output, HTTP contracts, UI behavior    | A test needing internals means the interface or seam is wrong  |
| **Gray-box**            | Stateful services, adapter contracts, durable state     | Setup and assertions still cross the public interface          |
| **White-box**           | Algorithms and invariants where the branch IS the proof | Heavy internal reach means a missing seam; restructure instead |

- **contract test**: assert the real dependency's behavior (real DB, real API) before mocking it. If you cannot explain what the real dependency does, write this first.
- **live boundary probe**: production behavior that depends on an external system pairs its mocked test with at least one live probe, so a mock cannot hide a contract break.
- **Seam rule**: mock at owned interfaces only. One adapter is a hypothetical seam; two adapters make it real.

## Direct Behavioral Probes

Tests are direct behavioral probes: assert observable outcomes, not mock calls.

```ts
const api = { save: jest.fn().mockResolvedValue({ ok: true }) }
const repo = new UserRepo(api)
const result = await repo.save({ name: 'Alice' })
expect(result).toEqual({ ok: true, user: { name: 'Alice' } })
```

A mock-call assertion ("was save called?") passes when the repo forgets to await, mishandles errors, or returns the wrong shape. The outcome assertion catches those.

## Common Mistakes

Tautology tests; mock-only assertions; test-only methods; mocking the implementation; `jest.mock` for everything; "test passes" without checking; shared state; snapshot tests without intent; testing private methods; asserting call order without need.

## Red Flags

Test passes when body is empty; test asserts only `toHaveBeenCalled`; `_method` in prod; `jest.mock` without scope; shared `beforeEach` mutation; tests depend on each other; snapshot of a snapshot; testing private via cast.

## Anti-Patterns

**Tautology**; **mock test**; **test-only method**; **mock everything**; **no contract**; **shared state**; **private testing**.

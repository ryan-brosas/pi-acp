---
name: defense-in-depth
description: Use when invalid data causes failures deep in execution, requiring validation at multiple system layers - validates at every layer data passes through to make bugs structurally impossible
disable-model-invocation: true
---


# Defense in Depth

## When to Use

Invalid data causes failures deep in the stack; type system alone isn't enough; trust boundary crossing is unclear; "valid here, invalid there" recurs.

## When NOT to Use

Single boundary (one validation point is enough); internal data flow; perf-critical and re-validation cost is real (rare).

## Core Principle

**Validate at every layer data passes through.** Each layer is a trust boundary. Boundaries exist at: network, persistence, third-party, internal module, type-changing transformation. Each boundary gets a schema.

Don't trust upstream to validate. Don't trust downstream to be robust. Validate at the boundary you're crossing.

## Layer Map

```
[Network]  ←  schema validation
   ↓
[Controller]  ←  decode + parse path/query/body
   ↓
[Service]  ←  validate pre-conditions + domain rules
   ↓
[Repository]  ←  validate shape, sanitize for SQL
   ↓
[Database]  ←  constraints, types, CHECK
```

Each arrow is a boundary. Each boundary validates.

## When to Validate

| Boundary | Validate? | Why |
|---|---|---|
| HTTP request | YES | Untrusted input from anywhere |
| Job queue input | YES | Queued by another service / version |
| Internal function call | NO | Types should be enough |
| DB read into domain type | YES | DB schema ≠ domain schema |
| Config / env var | YES | Operator can set anything |
| User-provided file | YES | Untrusted bytes |

Anything from outside the type system (network, queue, file, env, DB) gets validated. Within (function calls), trust the type.

## Defense Patterns

1. **Schema at the boundary.** Decode unknown → typed value.
2. **Domain validation.** "User with this email exists" — service layer.
3. **DB constraints.** Belt and suspenders: even if app validation fails, the DB refuses.
4. **Type narrowing.** `unknown` → narrow → use. Never use `any` to skip.
5. **Errors as data.** Failed validation is a typed error, not an exception.

## Why Multiple Validations

- **App validation** catches the most common cases (UX matters)
- **DB constraints** catch the rest (safety net, race conditions)
- **Multiple checks** mean a bug in one layer doesn't propagate

The cost of re-validating is real but small compared to the cost of corrupt data.

## Common Mistakes

Validation only at network (deep code trusts the type, gets garbage); validation only at DB (bad UX); `as any` to skip; "we trust this source" (sources change); validation scattered; validation in business logic; no validation for env vars or queue messages.

## Red Flags

`as any` near boundary; validation only at network; "we trust this source"; no validation for env / queue; validation in middle of function (should be at boundary); try/catch for validation (errors are data); no DB constraints; "the type system catches it" (catches what you typed, not what user sent).

## Anti-Patterns

**Validation only at network**; **validation only at DB**; **`as any` to skip**; **no env validation**; **validation in business logic**; **try/catch for validation**; **"we trust this"**; **no DB constraints**.

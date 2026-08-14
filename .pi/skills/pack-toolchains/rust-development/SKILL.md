---
name: rust-development
description: "Use when writing or reviewing Rust - ownership, error handling, traits, async, Cargo, and testing conventions."
disable-model-invocation: true
---

# Rust Development

## Use when

Writing or reviewing Rust binaries or libraries.

## Do not use when

Prototyping in another language; only use Rust when the safety or performance contract pays for it.

## Key rules

- `Result` and `Option` for fallible and missing values; no panics across module boundaries.
- `thiserror` for library errors, `anyhow` for application errors.
- Traits for polymorphism; prefer composition and generics over inheritance-style design.
- Async with tokio for I/O-bound work; never block the runtime.
- cargo fmt and clippy in CI; treat warnings as errors for the crate.
- Unit tests inline, integration tests in `tests/`; test the public API, not internals.
- Module layout by domain, not by type kind.
- Document public items; missing docs on exported APIs is a lint failure.
- Pin dependency versions; audit the dependency tree.

## Red flags

`unwrap` on untrusted input; unsendable state across await; no tests on the public API; warnings in CI.

## Skill Result Contract

```xml
<skill_result>
  <skill>rust-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Error handling, async boundaries, clippy/fmt results, tests</evidence>
  <artifacts>Crate code, tests, lint config</artifacts>
  <risks>Panic path, missing docs, or none</risks>
</skill_result>
```

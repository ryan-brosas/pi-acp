# Rust Development Guide

Source: adapted from claude-mpm `src/claude_mpm/skills/bundled/toolchains/rust/core/SKILL.md` (local CGC reference).

## Ownership and data

- Value types by default; borrow only when needed; `Arc` for shared ownership across threads.
- Make invalid states unrepresentable with the type system (newtypes, enums).

## Errors

- `Result` at every fallible boundary; `Option` for absence.
- `thiserror` for library error types; `anyhow` for application context.
- No `unwrap` on untrusted input; propagate or convert explicitly.

## Traits and generics

- Traits for behavior contracts; prefer generics over trait objects on hot paths.
- Keep trait objects behind interfaces where dynamic dispatch pays for itself.
- Derive `Debug`, `Clone`, `PartialEq` where sensible; implement `From` for conversions.

## Async and concurrency

- tokio for async; never block the runtime in async code.
- `spawn` with owned data; use `JoinSet` to track and bound tasks.
- Prefer message passing over shared locks where the design allows.

## Cargo and tooling

- cargo fmt and clippy in CI; deny warnings on the crate.
- `cargo audit` for the dependency tree; pin versions.
- Unit tests inline; integration tests in `tests/` exercising the public API.

## Architecture

- Modules by domain; public API documented; `missing_docs` lint on exported items.
- Libraries over monolithic binaries; keep the crate boundary meaningful.

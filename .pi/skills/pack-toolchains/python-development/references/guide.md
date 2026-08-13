# Python Development Guide

Source: adapted from claude-mpm `src/claude_mpm/skills/bundled/toolchains/python/core/SKILL.md` (local CGC reference).

## Environment

- venv or uv for isolation: `python -m venv .venv` then activate; uv for faster installs.
- Never install into the system interpreter; declare dev and prod groups separately.

## Packaging

- `pyproject.toml` as the single source of truth: project metadata, dependencies, build backend.
- Pin exact versions for release; use ranges for libraries.

## Typing

- Type hints on all public signatures; `mypy --strict` in CI.
- Typed `dict` and `dataclass` contracts instead of raw dicts across module boundaries.
- `TypeAlias` for complex repeated types; avoid `Any` except at true boundaries.

## Async

- asyncio for I/O-bound concurrency; threads or processes for CPU-bound work.
- Prefer `asyncio.to_thread` over manual loop management for blocking calls.
- Never share mutable state across tasks without a lock or queue.

## Resources

- Context managers for files, sockets, and connections; `contextlib` for custom ones.
- Explicit connection closing; pools are closed on shutdown.

## Testing

- pytest with fixtures scoped deliberately (session vs module vs function).
- Parametrize cases; assert behavior, not implementation.
- Coverage for the happy path, boundaries, and error paths.

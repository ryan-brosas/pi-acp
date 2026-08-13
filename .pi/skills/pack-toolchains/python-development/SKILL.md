---
name: python-development
description: "Use when writing or reviewing Python - typing, packaging, virtual environments, async, resource handling, and pytest testing conventions."
disable-model-invocation: true
---

# Python Development

## Use when

Writing or reviewing Python code, adding packages, or structuring a Python project.

## Do not use alone when

Flask, FastAPI, or Django work — pair this leaf with the matching framework leaf (`flask-development`, `fastapi-development`, or `django-development`).

## Key rules

- Type hints everywhere; run mypy strict in CI.
- Isolate environments: venv or uv; never install into the system interpreter.
- Package with pyproject.toml; declare dependencies explicitly and pin for release.
- Async for I/O-bound work; threads or processes for CPU-bound work; never mix blindly.
- Context managers for resources: files, sockets, DB connections.
- Dataclasses or typed structures for value objects; avoid dicts for contracts.
- Test with pytest; fixture scope matters (session, module, function).
- No mutable default arguments; no bare except; fail loudly on impossible states.

## Red flags

Dynamic typing where a type would do; global mutable state; swallowing exceptions; import side effects; vendored deps.

## Skill Result Contract

```xml
<skill_result>
  <skill>python-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Typing, packaging, env setup, tests, lint results</evidence>
  <artifacts>Project structure, pyproject, test suite</artifacts>
  <risks>Type drift, unpinned deps, or none</risks>
</skill_result>
```

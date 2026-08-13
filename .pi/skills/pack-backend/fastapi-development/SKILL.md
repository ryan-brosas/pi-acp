---
name: fastapi-development
description: "Use when building FastAPI APIs - Pydantic models, dependency injection, async boundaries, OpenAPI generation, lifespan, and testing."
disable-model-invocation: true
---

# FastAPI Development

## Use when

Building or extending FastAPI services: new endpoints, schemas, dependencies, background work, or tests.

## Do not use when

Synchronous CRUD without async needs; `flask-development` may fit better.

## Key rules

- Pydantic v2 for all request and response schemas; validate at the boundary.
- `Depends` for dependency injection; compose small, testable dependencies.
- Async handlers for I/O-bound work; never block the event loop with sync calls.
- `lifespan` for startup and shutdown: DB pools, clients, cleanup.
- OpenAPI is generated; keep operation IDs and tags intentional.
- Return typed responses; use status codes and exception handlers for errors.
- Long-running work goes to a queue, not to `BackgroundTasks` beyond small jobs.
- Test with `TestClient` and pytest; cover validation, auth, and error paths.
- Secrets via settings and env; never in code or docs.

## Red flags

Blocking calls in async routes; schemas duplicating models; missing status codes; BackgroundTasks for heavy jobs; secrets in config.

## Skill Result Contract

```xml
<skill_result>
  <skill>fastapi-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Schemas, routes, dependencies, lifespan, tests, run command</evidence>
  <artifacts>API code, tests, OpenAPI contract</artifacts>
  <risks>Blocking async path, missing validation, or none</risks>
</skill_result>
```

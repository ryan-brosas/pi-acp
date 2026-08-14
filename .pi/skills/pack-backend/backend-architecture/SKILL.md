---
name: backend-architecture
description: 'Use when designing or reviewing backend service structure - layering, module boundaries, dependency direction, service decomposition, and interface-first design.'
disable-model-invocation: true
---

# Backend Architecture

## Use when

Designing a new service, splitting a monolith, or reviewing backend structure. Interface and boundary decisions are load-bearing.

## Do not use when

Single-file scripts or prototypes; `prototype` or `incremental-implementation` covers those.

## Key rules

- Layers depend inward; the domain never imports web, DB, or transport code.
- Interfaces are owned by their consumers, not their implementors.
- Domain packages over layer packages: `internal/user/` not `internal/handlers/`.
- No catch-all `utils` or `common` packages; helpers live in the domain that owns them.
- Deep modules: small surface, real implementation. Avoid shallow pass-through layers.
- Dependency injection happens at the composition root, not inside every module.
- Validate at boundaries; trust types inside. Make invalid states unrepresentable.
- Keep seams for testing: inject time, clock, and external clients rather than importing them.
- Prefer composition over inheritance; keep abstractions narrow.
- Document the dependency direction explicitly; the build or linters can enforce it.

## Red flags

Presentation logic in services; domain importing the ORM; circular package deps; god objects; layers that only pass data through; untestable globals.

## Skill Result Contract

```xml
<skill_result>
  <skill>backend-architecture</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Boundary and dependency map, interface list, review findings</evidence>
  <artifacts>Architecture notes or refactor plan</artifacts>
  <risks>Coupling left in place, unstated assumptions, or none</risks>
</skill_result>
```

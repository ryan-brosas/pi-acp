---
name: dotnet-development
description: "Use when writing or reviewing C# and .NET - ASP.NET Core APIs, async, dependency injection, Entity Framework Core, and xUnit testing."
disable-model-invocation: true
---

# .NET Development

## Use when

Writing or reviewing C#/.NET APIs, services, or libraries.

## Do not use when

Small cross-platform scripts; `python-development` or `shell-development` may fit.

## Key rules

- async/await end to end; never `.Result` or `.Wait()` on tasks.
- Constructor dependency injection; register lifetimes deliberately (scoped for stateful services).
- EF Core for relational data with migrations; Dapper for hot query paths when needed.
- Options pattern for configuration; secrets via user-secrets or env, never in code.
- `ILogger` for structured logging; no Console.WriteLine in services.
- Minimal APIs for small services; controllers for larger surfaces.
- xUnit + FluentAssertions; test behavior, not implementation.
- `dotnet format` and analyzers in CI; treat warnings as errors.

## Red flags

Blocking on async; service locator; DbContext held too long; config in code; no analyzers.

## Skill Result Contract

```xml
<skill_result>
  <skill>dotnet-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Project structure, DI, EF Core, logging, tests, build results</evidence>
  <artifacts>Source, migrations, tests, build config</artifacts>
  <risks>Async deadlock, config drift, or none</risks>
</skill_result>
```

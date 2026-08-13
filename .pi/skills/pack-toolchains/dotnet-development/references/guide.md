# .NET Development Guide

Source: adapted from agents `plugins/dotnet-contribution/skills/dotnet-backend-patterns/SKILL.md` (local CGC reference).

## Async

- async/await end to end; never `.Result` or `.Wait()`; sync-over-async deadlocks.
- ConfigureAwait(false) in library code; use `ValueTask` for hot paths.

## Dependency injection

- Constructor injection; register lifetimes deliberately: scoped for request state, singleton for stateless.
- Options pattern (`IOptions<T>`) for configuration; validate at startup.

## Persistence

- EF Core for relational data; migrations generated and reviewed.
- Dapper for hot read paths when EF adds overhead; keep SQL parameterized.
- DbContext per request scope; never hold it longer than the operation.

## Logging and config

- `ILogger` with structured logging; no Console.WriteLine in services.
- user-secrets and env for secrets; never in appsettings committed to git.

## APIs

- Minimal APIs for small services; controllers for larger surfaces.
- Return typed results; central exception handling middleware.

## Testing

- xUnit + FluentAssertions; test behavior, not implementation.
- WebApplicationFactory for integration tests; Testcontainers for real dependencies.
- `dotnet format` and analyzers in CI; treat warnings as errors.

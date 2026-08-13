# Java Development Guide

Source: adapted from antigravity-awesome-skills `skills/java-pro/SKILL.md` (local CGC reference).

## Java 21+

- Records for data carriers; sealed interfaces for closed hierarchies; pattern matching over instanceof chains.
- Virtual threads for I/O-heavy concurrency; keep CPU-bound work on platform threads.
- Text blocks, switch expressions, and sequenced collections where they fit.

## Spring Boot

- Constructor injection; never field injection.
- Component scan kept narrow; configuration classes explicit.
- Profiles for environments; secrets via env, never in properties.

## Persistence

- Repository pattern over raw JDBC; entities map, queries stay intentional.
- `@Transactional` at service boundaries; avoid transaction-per-web-request anti-patterns.
- Bean Validation on DTOs at the boundary.

## Testing

- JUnit 5 + AssertJ; name tests by behavior.
- Test slices (web, data) instead of the full context where possible.
- Mock external clients; keep integration tests tagged.

## Build

- Maven or Gradle with a lockfile; review dependency upgrades.
- Spotless/checkstyle in CI; fail on violations.

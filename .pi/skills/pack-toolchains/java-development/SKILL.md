---
name: java-development
description: 'Use when writing or reviewing Java - Java 21 features, Spring Boot, dependency injection, persistence, and testing conventions.'
disable-model-invocation: true
---

# Java Development

## Use when

Writing or reviewing Java services, Spring Boot apps, or libraries.

## Do not use when

Small scripts; consider `python-development` or `go-development` for lightweight work.

## Key rules

- Use modern Java: records, sealed types, pattern matching, virtual threads for I/O-heavy concurrency.
- Spring Boot with constructor injection; no field injection.
- Transactional boundaries at the service layer, not in controllers.
- Repository pattern over raw JDBC; let the ORM map, keep queries intentional.
- Bean Validation at the boundary; never trust the client.
- JUnit 5 + AssertJ for tests; name tests by behavior.
- Maven or Gradle with a lockfile; review dependency upgrades.
- Profile-based configuration; secrets via env, never in properties.
- Keep controllers thin; logic lives in services.

## Red flags

Field injection; logic in controllers; unchecked generics; sysout logging; mutable shared state in services.

## Skill Result Contract

```xml
<skill_result>
  <skill>java-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Project structure, DI, persistence, tests, build results</evidence>
  <artifacts>Source, tests, build config</artifacts>
  <risks>N+1 queries, weak validation, or none</risks>
</skill_result>
```

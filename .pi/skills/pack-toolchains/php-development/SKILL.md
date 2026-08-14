---
name: php-development
description: 'Use when writing or reviewing PHP - modern PHP 8 features, Composer, Laravel or Symfony conventions, and PHPUnit testing.'
disable-model-invocation: true
---

# PHP Development

## Use when

Writing or reviewing PHP apps, APIs, or packages.

## Do not use when

Non-PHP backends; `python-development` or `go-development` covers those.

## Key rules

- Use modern PHP: typed properties, enums, readonly classes, attributes.
- Composer for dependencies and autoloading; never commit vendor.
- Pick one framework (Laravel or Symfony) and follow its conventions.
- Eloquent or Doctrine for persistence; avoid raw SQL concat.
- Dependency injection via the container; no global service access.
- PHPUnit for tests; cover request, service, and boundary behavior.
- PHPStan or Psalm at a high level in CI; fix what they flag.
- Strict types at every file boundary.
- Secrets via env; never in config files committed to git.

## Red flags

String concat SQL; magic arrays where types would do; globals; framework views doing logic; warnings in CI.

## Skill Result Contract

```xml
<skill_result>
  <skill>php-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Structure, typed models, tests, static analysis results</evidence>
  <artifacts>App code, migrations, test suite</artifacts>
  <risks>SQL injection, weak typing, or none</risks>
</skill_result>
```

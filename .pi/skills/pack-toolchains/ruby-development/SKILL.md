---
name: ruby-development
description: 'Use when writing or reviewing Ruby - Rails conventions, Active Record, background jobs, and RSpec testing.'
disable-model-invocation: true
---

# Ruby Development

## Use when

Writing or reviewing Ruby or Rails apps, gems, or scripts.

## Do not use when

Non-Ruby backends; `python-development` or `go-development` covers those.

## Key rules

- Follow Rails conventions; deviate with a stated reason.
- Active Record: use scopes and eager loading to avoid N+1.
- Strong Parameters for all mass assignment; never trust params.
- Background jobs with Sidekiq; keep jobs idempotent and small.
- RSpec for tests; describe behavior, not methods.
- Manage gems with Bundler; pin versions for release.
- rubocop in CI; keep the default style unless the team decides otherwise.
- Migrations are the schema truth; roll back and forward cleanly.

## Red flags

Mass assignment; N+1 queries; logic in models that belongs in services; jobs without idempotency; skipped tests.

## Skill Result Contract

```xml
<skill_result>
  <skill>ruby-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Models, controllers, jobs, tests, lint results</evidence>
  <artifacts>App code, migrations, test suite</artifacts>
  <risks>N+1 queries, weak params, or none</risks>
</skill_result>
```

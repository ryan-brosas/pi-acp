---
name: django-development
description: 'Use when building Django apps - models, migrations, ORM query optimization, views, DRF APIs, permissions, and transactions.'
disable-model-invocation: true
---

# Django Development

## Use when

Building or extending Django projects: models, migrations, ORM queries, views, DRF APIs, or permissions.

## Do not use when

Small APIs that do not need Django's batteries; `flask-development` or `fastapi-development` fits.

## Key rules

- Models carry behavior close to the data; migrations are reviewed, not hand-edited.
- Avoid N+1: `select_related` for forward relations, `prefetch_related` for reverse.
- Use class-based views or DRF; keep querysets in managers or services.
- Permissions are authorization, not authentication; test the negative cases.
- Transactions wrap multi-step writes; keep transaction blocks short.
- Settings from env with sensible defaults; split by environment via a base settings module.
- Use the admin for internal tooling; never expose it to end users without hardening.
- Test with pytest-django; cover views, permissions, and query behavior.

## Red flags

N+1 queries; permissions checked only in templates; settings with secrets; migrations out of sync; heavy logic in views.

## Skill Result Contract

```xml
<skill_result>
  <skill>django-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Models, migrations, views, permissions, tests</evidence>
  <artifacts>App code, migration files, test suite</artifacts>
  <risks>N+1 queries, weak authz, or none</risks>
</skill_result>
```

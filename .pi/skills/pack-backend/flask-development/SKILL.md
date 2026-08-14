---
name: flask-development
description: 'Use when building Flask web apps or APIs - application factories, blueprints, configuration, SQLAlchemy models and migrations, authentication, and testing.'
disable-model-invocation: true
---

# Flask Development

## Use when

Building or extending Flask apps and APIs: new routes, blueprints, models, migrations, auth, or test coverage.

## Do not use when

Small scripts that do not need a web app; use `python-development` alone.

## Key rules

- Application factory: `create_app(config)` returns the app; never a module-level singleton.
- Blueprints for feature modules; register them in the factory.
- Configuration from environment variables with safe defaults; never hardcode secrets.
- SQLAlchemy session scoped per request; commit at the boundary, rollback on error.
- Alembic for migrations; generate and review every migration.
- Keep views thin; move business logic to services that are testable without the client.
- Validate request data with a schema; return consistent error responses.
- Authentication via extension (Flask-Login, JWT) with hashed passwords (bcrypt/argon2).
- Test with pytest and the test client; cover routes, auth, and error paths.
- Run with `flask run` in dev; gunicorn behind a proxy in production.

## Red flags

Global app object; config in code; sessions held open across requests; migrations hand-edited; views with business logic; secrets in settings.

## Skill Result Contract

```xml
<skill_result>
  <skill>flask-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Factory, routes, models, migrations, tests, run command</evidence>
  <artifacts>App code, migration files, test suite</artifacts>
  <risks>Missing auth, unpinned deps, or none</risks>
</skill_result>
```

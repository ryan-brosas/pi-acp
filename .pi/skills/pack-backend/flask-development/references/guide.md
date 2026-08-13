# Flask Development Guide

Source: adapted from claude-mpm `plugin/skills/toolchains-python-frameworks-flask/SKILL.md` (local CGC reference).

## Application factory

```python
def create_app(config=None):
    app = Flask(__name__)
    app.config.from_object(config or DefaultConfig)
    register_blueprints(app)
    db.init_app(app)
    return app
```

- One factory per app; tests call it with test config.

## Blueprints

- One blueprint per feature module; register with a URL prefix.
- Keep route files thin; business logic in services.

## Configuration

- Config from environment with safe defaults; `app.config.from_prefixed_env()`.
- Never commit secrets; validate required settings at startup.

## SQLAlchemy

- Scoped session per request; commit at the boundary, rollback on error.
- Alembic for migrations: `alembic revision --autogenerate`, review the output.

## Auth

- Flask-Login or JWT with bcrypt/argon2 hashing; never store plaintext.
- Rate limit login; protect admin routes separately.

## Running and testing

- Dev: `flask run --debug`. Prod: gunicorn workers behind a proxy.
- pytest with the test client; cover routes, auth, and error paths.

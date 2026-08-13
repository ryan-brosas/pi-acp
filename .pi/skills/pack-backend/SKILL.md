---
name: pack-backend
description: "Backend and service router: server architecture, API implementation, Python web frameworks, background jobs, observability, and distributed-system patterns."
---

# Backend & Services

Route backend work. Framework tasks pair ONE backend leaf with ONE toolchain leaf (max two leaves total).

## Members

- backend-architecture: layering, boundaries, service decomposition
- api-implementation: REST, GraphQL, gRPC, validation, errors, idempotency
- flask-development: Flask apps, factories, blueprints, SQLAlchemy, migrations
- fastapi-development: FastAPI, Pydantic, dependency injection, OpenAPI
- django-development: Django models, ORM, views, DRF, permissions
- background-jobs: queues, retries, idempotency, scheduled work
- service-observability: structured logs, metrics, tracing, health checks
- distributed-systems-patterns: timeouts, retries, circuit breakers, sagas

## Routing

- Flask task: python-development + flask-development
- FastAPI task: python-development + fastapi-development
- Django task: python-development + django-development
- Load no more than two leaves; never one leaf per framework plus language.

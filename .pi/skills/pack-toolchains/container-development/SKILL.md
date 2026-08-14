---
name: container-development
description: 'Use when containerizing applications - Dockerfiles, multi-stage builds, Compose, non-root execution, and health checks.'
disable-model-invocation: true
---

# Container Development

## Use when

Writing or reviewing Dockerfiles, Compose files, or containerized deployments.

## Do not use when

Serverless or managed platforms that own the runtime; `pack-platform` covers those.

## Key rules

- Multi-stage builds: build in one stage, copy artifacts into a slim runtime.
- Pin base image tags; never use floating `latest`.
- Run as non-root; create a dedicated user in the image.
- `HEALTHCHECK` matching the app's readiness semantics.
- `.dockerignore` to keep the build context small and secret-free.
- Compose for local dev; named volumes for state, not container layers.
- No secrets in images or layers; use env at runtime or a secret store.
- Order layers for cache: dependencies before code.
- Keep images small: one purpose, no debug tools in production.

## Red flags

Root in container; secrets baked into layers; giant single-stage images; missing health checks; `latest` tags.

## Skill Result Contract

```xml
<skill_result>
  <skill>container-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Dockerfile, Compose, non-root setup, health check, image size</evidence>
  <artifacts>Container config files</artifacts>
  <risks>Secret in layer, root user, or none</risks>
</skill_result>
```

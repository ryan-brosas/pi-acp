# Container Development Guide

Source: adapted from claude-mpm `plugin/skills/toolchains-universal-infrastructure-docker/SKILL.md` (local CGC reference).

## Dockerfile shape

- Multi-stage: build stage with the toolchain, runtime stage with artifacts only.
- Pin base image digests or minor tags; never floating `latest`.
- Order layers dependency-first for cache reuse.
- One process per container; no init system bloat.

## Runtime hardening

- Non-root user: `USER app` after copying; chown owned paths only.
- `HEALTHCHECK` matching readiness; expose the health port.
- `.dockerignore`: node_modules, .git, build caches, secrets.

## Secrets and state

- No secrets in image layers; env at runtime or a secret store.
- State in named volumes or external stores, not container layers.

## Compose

- Compose for local dev: services, volumes, healthcheck dependencies.
- `depends_on` with condition for readiness, not just start order.
- Keep prod manifests separate from dev compose.

## Verification

- Build with `--no-cache` in CI at least weekly to catch drift.
- `docker scout` or equivalent for vulnerability scanning.
- Compare final image size; cut debug tooling from runtime stages.

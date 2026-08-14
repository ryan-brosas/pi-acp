---
name: ci-cd-and-automation
description: Use when setting up CI/CD pipelines, GitHub Actions workflows, automated testing in CI, or deployment automation — covers pipeline design, caching, secrets management, and release workflows
disable-model-invocation: true
---

# CI/CD & Automation

## Iron Laws

<EXTREMELY-IMPORTANT>
- **CI runs on every PR.** No exceptions. PRs without green CI do not merge.
- **Main is always deployable.** If main is broken, team is blocked. Fix or revert.
- **Cache dependencies, not source.** Key on lockfile. 90% of CI is install.
- **Secrets via platform store.** Never in workflow YAML. Never in logs.
- **Fast feedback.** 5-min CI > 30-min CI.
</EXTREMELY-IMPORTANT>

## When to Use

Setting up CI for a new project; adding a job (lint, typecheck, test, security, build, deploy); caching slow steps; secrets in CI; release workflow (semver, changelog, npm publish); matrix builds; deploy previews.

## When NOT to Use

Manual deploys (CI is the answer); one-off scripts (use Make or just); long-running batch jobs (use a queue, not CI); a workflow that runs > 30 min (split it).

## Pipeline Anatomy

```
[Trigger] → [Setup + Cache] → [Lint] → [Typecheck] → [Test] → [Build] → [Deploy]
```

| Step               | Budget |
| ------------------ | ------ |
| Lint               | < 30s  |
| Typecheck          | < 1m   |
| Test (unit)        | < 5m   |
| Test (integration) | < 10m  |
| Build              | < 5m   |
| Deploy preview     | < 10m  |
| Deploy prod        | < 15m  |

Over budget → separate job (parallel).

## Caching

```yaml
- uses: actions/cache@v4 # cache the package-manager store; pair with `npm ci` or equivalent
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

Key on the lockfile hash, restore-key as fallback. Cache the install dir, not the source.

## Secrets

```yaml
- name: Deploy
  env:
    API_TOKEN: ${{ secrets.API_TOKEN }}
  run: ./deploy.sh
```

`secrets.*` in env. Never `echo` the secret. Never `set -x` with secrets. Use `::add-mask::` if a secret might leak.

## Matrix Builds

```yaml
strategy:
  matrix:
    node: [18, 20, 22]
    os: [ubuntu-latest, macos-latest]
```

Don't test dead versions. Update when the floor moves.

## Deploy Strategies

| Strategy   | When                           |
| ---------- | ------------------------------ |
| Rolling    | Default for most services      |
| Blue/green | Zero-downtime, canary-able     |
| Canary     | Small % of traffic, ramp       |
| Recreate   | Acceptable downtime, stateless |

## Release Workflow

```
PR merge → [CI: tests + build] → [Release: bump version] → [Publish] → [Deploy]
```

Use release-please or similar. Manual bumps = drift = bugs.

## Common Mistakes

CI only on main (bugs caught late); no cache; secrets in logs; one giant job; "skip ci" bypass; deploy on every PR (preview instead); no artifact upload; matrix with dead versions; manual release; flaky tests not quarantined; no notifications.

## Red Flags

CI only on main; no cache (5+ min install); secrets visible in logs; single big job; "skip ci" used; deploy on PR; no notifications; flaky tests pass/fail randomly; matrix with 3-year-old versions; "the CI is broken, just push to main".

## Anti-Patterns

**CI on main only**; **no cache**; **secrets in logs**; **one big job**; **deploy on PR**; **manual release**; **"skip ci"**; **no notifications**.

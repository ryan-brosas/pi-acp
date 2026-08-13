# Implementation Tasks

**Issue:** none
**Work ID:** close-dogfood-findings-f008-f033
**Spec:** `.pi/work/close-dogfood-findings-f008-f033/spec.md`
**Date:** 2026-08-14

## S1 — Freshness and baseline reconciliation

```yaml
id: S1
depends_on: []
parallel: false
files: [src/acp/agent.ts, test/unit/startup-info-ide.test.ts, package.json, README.md]
acceptance: [node scripts/check.mjs, focused startup-info tests]
```

- [ ] Profile and budget session/new and startupInfo.
- [ ] Replace routine absolute paths with portable labels/counts.
- [ ] Add stale-build/fresh-chat evidence and reconcile implemented findings.

## S2 — Lifecycle and isolation

```yaml
id: S2
depends_on: [S1]
parallel: false
files: [scripts/lib/acp-smoke.mjs, scripts/smoke-*.mjs, test/, package.json]
acceptance: [npm run smoke:sessions, focused lifecycle tests]
```

- [ ] Add deterministic cancellation and late-update rejection.
- [ ] Add new/list/load/replay/delete/idempotence and invalid-request lanes.
- [ ] Isolate state in temporary `PI_CODING_AGENT_DIR` and assert cleanup.

## S3 — MCP and security

```yaml
id: S3
depends_on: [S2]
parallel: false
files: [scripts/, src/acp/mcp-bridge.ts, test/unit/mcp-bridge.test.ts, test/unit/mcp-sse.test.ts, README.md]
acceptance: [npm run smoke:mcp-fixture, focused MCP tests]
```

- [ ] Exercise non-empty authenticated descriptors and safe invocation.
- [ ] Prove bridge cancellation/cleanup and nested redaction.
- [ ] Persist list-change and conditional debugger guidance.

## S4 — Portability and inventory

```yaml
id: S4
depends_on: [S3]
parallel: false
files: [src/pi-rpc/command.ts, src/acp/agent.ts, scripts/, package.json, README.md, .github/workflows/check.yml]
acceptance: [inventory fault injection, Node matrix inspection, npm test]
```

- [ ] Centralize configured Pi command/package resolution.
- [ ] Validate smoke classification, reachability, and deadline ownership.
- [ ] Add Node 20/current CI and generalize metadata.

## S5 — Reporting and release acceptance

```yaml
id: S5
depends_on: [S4]
parallel: false
files:
  [
    scripts/,
    package.json,
    docs/findings/2026-08-14-jetbrains-acp-dogfood-findings.md,
    .pi/work/close-dogfood-findings-f008-f033/verification.md
  ]
acceptance: [npm run dogfood:report, npm run dogfood:ide, full repository gate]
```

- [ ] Emit versioned redacted JSON and Markdown reports.
- [ ] Add bounded fresh-JetBrains acceptance/unavailable recording.
- [ ] Reconcile every finding and run all gates plus independent review.

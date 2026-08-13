# Close Dogfood Findings F-008–F-033

**GitHub issue:** none
**Work ID:** close-dogfood-findings-f008-f033
**Repository:** ryan-brosas/pi-acp-jetbrain
**Created:** 2026-08-14
**Status:** Approved

## Work Metadata

```yaml
issue: none
depends_on: []
parallel: false
conflicts_with: []
files:
  [
    scripts/,
    src/,
    test/,
    package.json,
    README.md,
    .github/workflows/check.yml,
    docs/findings/2026-08-14-jetbrains-acp-dogfood-findings.md
  ]
acceptance: [node scripts/check.mjs, npm test, npm run lint, npm run typecheck, npm run build, npm run smoke:full]
estimated_hours: 12
```

## Problem Statement

F-008 through F-033 remain open or stale. They require deterministic lifecycle, MCP, security, portability, reporting, and fresh-host evidence so release claims are unambiguous and dogfood cannot pollute real user state.

## Scope

### In scope

- Reconcile stale statuses against current code and commits.
- Add built-artifact probes for cancellation, lifecycle, invalid requests, isolated storage, and non-empty MCP descriptors.
- Harden command resolution, redaction, inventory validation, startup payload/path output, metadata, Node CI, and reports.
- Add bounded fresh-JetBrains acceptance for host-only evidence.

### Out of scope

- Unstable GUI automation without a headless interface.
- Killing user-owned IDE processes without confirmation.
- Pushes or remote repository mutation.
- Closing host-only findings without fresh-process evidence.

## Closure model

Automatable findings close with tests/probes. IDE-only F-008, F-009, F-021, F-030, and F-033 get a bounded acceptance command and remain `Awaiting fresh-host evidence` until it records new PID/build/tool/inspection/lifecycle evidence. Reports must exclude tokens, descriptor values, and absolute home paths.

## Stations

### S1 — Freshness and baseline reconciliation

Profile and budget startup output, remove routine absolute paths, add stale-build guidance, and reconcile already-implemented findings.

**Acceptance:** focused startup-info tests plus canonical gate.

### S2 — Lifecycle and isolation

Add built-dist cancellation, isolated list/load/delete/idempotence, invalid-request probes, and temporary `PI_CODING_AGENT_DIR` cleanup.

**Acceptance:** deterministic probes detect injected faults and leave no artifacts or owned children.

### S3 — MCP and security

Add authenticated fake MCP coverage, safe invocation, list-change evidence, nested redaction tests, and debugger availability guidance.

**Acceptance:** discovery/registration/call/cancel is bounded and secret sentinels never reach diagnostics or reports.

### S4 — Portability and inventory

Centralize Pi command/package resolution, add Node 20/current CI, validate smoke classification/reachability/deadlines, and align cross-IDE metadata.

**Acceptance:** inventory fault injection fails, CI matrix covers supported versions, configured changelog resolution passes.

### S5 — Reporting and release acceptance

Emit versioned redacted JSON/Markdown reports, add bounded fresh-host acceptance, reconcile every finding, and run full gates plus independent P0/P1 review.

**Acceptance:** report schema checks pass; host-only items remain honestly pending when no fresh host is supplied.

## Risks

| Risk                      | Mitigation                                               |
| ------------------------- | -------------------------------------------------------- |
| User session pollution    | Temporary agent directory and cleanup assertions.        |
| Flaky model cancellation  | Deterministic fake-pi lane; real-host evidence separate. |
| Secret leakage            | Deny-by-default sanitization and sentinels.              |
| Cross-cutting regressions | TDD station commits and focused gates.                   |
| Stale IDE evidence        | Require revision/PID/time from a fresh chat.             |

## Open Questions

None. User approved evidence-based closure.

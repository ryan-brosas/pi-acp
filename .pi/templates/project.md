---
purpose: Detailed project record: vision, architecture, flows, configuration, failure modes, observability, decisions, risks, and open questions (read on demand for project context)
updated: 2026-08-09
---

# Project

This file records the project's purpose and verified architecture. /init renders
it from this template during the one-time full initialization; update it when the
architecture or project direction changes. Every claim cites evidence: file:line,
config entry, command output, or an explicit user answer. When a fact cannot be
verified, write `[NEEDS CLARIFICATION: reason]` and ask.

## Purpose and Status

- **Goal** — one sentence, outcome-shaped. What does this project achieve?
- **Status** — [Discovery / Planning / Implementation / Polish / Maintenance]
- **Milestone** — [Current milestone, with evidence]
- **Next Milestone** — [Next milestone, or [NEEDS CLARIFICATION: reason]]

## Success Criteria

How do we know the project is successful? Each criterion is observable and
verifiable by using the project, not by checking code. Cite the check.

1. **[Criterion 1]** - [Specific, measurable outcome] — Verified by: [check]
2. **[Criterion 2]** - [Specific, measurable outcome] — Verified by: [check]
3. **[Criterion 3]** - [Specific, measurable outcome] — Verified by: [check]

## Target Users

- **Primary:** [User type and their core need]
- **Secondary:** [User type and their core need]
- **Non-goals:** [Explicitly not serving; prevents scope creep]

## Core Principles

Non-negotiable principles that guide decisions. Each traces to a decision record
or the user.

1. **[Principle 1]** - [Explanation] — Evidence: [source]
2. **[Principle 2]** - [Explanation] — Evidence: [source]

## System Context

- **External actors:** [who interacts with the system]
- **External systems:** [services it depends on or integrates with]
- **Trust boundaries:** [where authentication, authorization, or data isolation applies]
- **Runtime and environment:** [supported runtimes, versions, network constraints]

## Architecture Overview

- **Architectural style:** [e.g. modular monolith, microservices, layered, event-driven, configuration-only]
- **Component responsibilities:** list every major component and what it owns:
  - [Component] — [responsibility] — [owning path]
  - [Component] — [responsibility] — [owning path]
- **Composition roots:** [where components are wired together; entrypoints that construct the system]
- **Dependency rules:** [what may import or read what; no circular imports; what must not depend on what]
- **Key data structures or schemas:** [if any]

## Runtime Entrypoints

| Entrypoint | Kind | Path | Purpose | Config source |
| --- | --- | --- | --- | --- |
| [e.g. web server] | [server / CLI / worker / scheduled job / event consumer] | [path] | [purpose] | [config path] |

If no application runtime exists, say so and list operator or tool entrypoints instead.

## Request, Data, and Event Flows

- **Primary request flow:** [path a request takes through the components, with component names]
- **Write and read paths:** [how data is written and read back; who owns each store]
- **Background processing:** [jobs, queues, schedules]
- **Event publication and consumption:** [topics, producers, consumers]
- **Failure behavior of each flow:** [timeouts, retries, dead-lettering, backpressure]

## Configuration

- **Configuration sources:** [files, env vars, flags; which wins on conflict]
- **Secrets:** [where credentials are read from; never hardcode or commit them]
- **Environments:** [dev, staging, production; how configuration differs]
- **Validation:** [how invalid configuration is detected and surfaced]

## Data Ownership

- **Stores and schemas:** [database, tables/collections, owning module]
- **Cache ownership:** [what is cached and who owns the cache]
- **Transaction boundaries:** [where consistency is guaranteed]
- **Migration mechanism:** [how schema changes ship]

## External Integrations

| Service | Auth | Docs | Rate limits | Error handling |
| --- | --- | --- | --- | --- |
| [service] | [env var / mechanism] | [URL] | [known limits] | [pattern] |

## Deployment Topology

- **Build artifacts:** [what is built and shipped]
- **Runtime services:** [services and their hosts]
- **Environments:** [dev, staging, production — promotion path]
- **Health checks:** [endpoints and probes]
- **Rollback path:** [how a bad release is undone]

## Testing Architecture

- **Unit / integration / contract / e2e seams:** [what each layer covers and where]
- **Test locations:** [paths]
- **Live boundary probes:** [what needs a real service to verify]
- **Coverage gaps:** [known untested areas, with risk]

## Observability

- **Logging:** [what is logged, where it goes]
- **Metrics:** [key indicators and where they are exported]
- **Tracing:** [request correlation across components]
- **Alerting:** [what triggers an alert and who is paged]

## Failure Modes

For each realistic failure, record symptom, root cause, detection, and recovery:

| Failure | Symptom | Detection | Recovery |
| --- | --- | --- | --- |
| [failure] | [symptom] | [check or alarm] | [procedure or command] |

## Architectural Invariants

Rules that must never be violated:

- [Dependency rule or security boundary]
- [Generated-file ownership]
- [Compatibility constraint]

## Decisions

Significant architectural decisions, each linking to its record (ADR or decision
entry). Format: decision, date, rationale, alternatives considered.

| Date | Decision | Rationale | Alternatives | Record |
| --- | --- | --- | --- | --- |
| [date] | [decision] | [why] | [what was rejected] | [ADR link or section] |

## Known Risks and Hotspots

- [High-change module or coupling hotspot]
- [Missing test coverage]
- [Operational risk]

## Open Questions

| Question | Context | Blocking | Priority |
| --- | --- | --- | --- |
| [question] | [where it came up] | [yes/no] | [high/med/low] |

## Evidence

Every claim above cites a path, line range, config entry, or command. Add or
correct citations when you update this file.

---

_Update this file when architecture or project direction changes._
_AI reads this on demand to stay aligned with project goals and invariants._

---
purpose: Current project state, verification state, active decisions, blockers, and position tracking
updated: 2026-08-09
---

# State

## Current Position

<!-- Where are we right now? What just happened? -->

**Date:** [date]
**Project:** [project]
**Phase:** [phase name from roadmap.md]
**Status:** [In Progress / Blocked / Review]
**Active focus:** [what is being worked on now]
**Primary success criterion:** [from roadmap.md]
**Primary users:** [from roadmap.md]
**Tracker:** [issue tracker or none; do not invent IDs]

## Current Repository Condition

<!-- Working-tree and environment context an agent must respect -->

- Branch, remote, and any dirty state: [facts with evidence]
- Pre-existing changes owned by the user or other agents: [describe and how to protect]
- Environment facts that affect work: [runtimes, versions, network constraints]

## Verification State

<!-- What gates exist, what last ran, what passed -->

| Gate   | Command   | Last result             | Date   |
| ------ | --------- | ----------------------- | ------ |
| [gate] | [command] | [pass / fail / not run] | [date] |
| [gate] | [command] | [pass / fail / not run] | [date] |

**Pending checks:** [what has not run yet and why]

## Recent Completed Work

<!-- Last 3-5 completed tasks, with evidence -->

| Work         | Title   | Completed | Evidence                     |
| ------------ | ------- | --------- | ---------------------------- |
| [id or none] | [Title] | [Date]    | [artifact or command output] |

## Active Decisions

<!-- Decisions that affect current and future work; each cites rationale and impact -->

| Date   | Decision           | Rationale | Impact            | Evidence |
| ------ | ------------------ | --------- | ----------------- | -------- |
| [Date] | [What was decided] | [Why]     | [What it affects] | [source] |

## Blockers

| Work | Blocker       | Since  | Owner | Unblock path         |
| ---- | ------------- | ------ | ----- | -------------------- |
| [id] | [Description] | [Date] | [Who] | [what would unblock] |

## Open Questions

| Question   | Context            | Blocking | Priority       |
| ---------- | ------------------ | -------- | -------------- |
| [Question] | [Where it came up] | [Yes/No] | [High/Med/Low] |

## Context Notes

<!-- Important context that doesn't fit elsewhere -->

### Technical

- [Technical decision or constraint]

### Product

- [Product decision or direction]

### Process

- [Workflow change or improvement]

## Next Actions

<!-- Immediate next steps, ordered -->

1. [ ] [Action item with owner if applicable]
2. [ ] [Action item]

## Session Handoff

<!-- For multi-session work -->

**Last Session:** [Date]
**Next Session Priority:** [What is most important next]
**Known Issues:** [Issues to be aware of]
**Read first:** [Files to read before starting]
**Context Links:** [Relevant files, PRs, docs]

---

_Update this file at the end of each significant session or when state changes._
_This file is the "you are here" marker for the project. Keep observed facts
separate from planned work; mark unverified claims `[NEEDS CLARIFICATION:
reason]`._

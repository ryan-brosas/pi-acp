---
name: documentation-and-adrs
description: Use when writing technical documentation, Architecture Decision Records (ADRs), API docs, or project READMEs — covers documentation structure, ADR format, and keeping docs in sync with code
disable-model-invocation: true
---

# Documentation & ADRs

## When to Use

Project docs (README, contributing, onboarding); real architectural decisions (ADR); API docs; design docs that outlive the conversation; postmortems; runbooks.

## When NOT to Use

Doc is a code comment; no real decision was made; "let me document this" without audience; ephemeral context (use chat).

## Doc Hierarchy

```
README.md          ← first thing. What is this, who is it for, how to use it.
ARCHITECTURE.md    ← system shape, modules, data flow.
docs/
  adr/             ← WHY we chose X over Y.
  api/             ← API reference.
  guides/          ← task-oriented.
  runbooks/        ← operational.
  postmortems/     ← incident retrospectives.
```

Don't mix levels. A guide is not an ADR. A runbook is not a guide.

## ADR Format

```markdown
# ADR-NNN: Title

**Status:** proposed | accepted | deprecated | superseded by ADR-XXX
**Date:** YYYY-MM-DD
**Context:** [What is the situation? What forces are at play?]
**Decision:** [What did we choose?]
**Consequences:** [What becomes easier? What becomes harder? What did we give up?]
**Alternatives considered:** [What else was on the table, and why not?]
```

**Context** and **Consequences** are the most-skipped and most-load-bearing. Without them, the next person can't tell if the decision still applies.

## When to Write an ADR

- Two+ viable options, with real trade-offs.
- Hard to reverse.
- Will be questioned later.
- Affects system shape, not just implementation detail.

## When NOT to Write an ADR

- One viable option (just the way it is).
- Implementation detail (variable name, function sig).
- Easy to reverse (do it; document in code).
- No real trade-off.

## Keeping Docs in Sync

- Doc-as-code: docs live in the same repo, same review process.
- Update on the same PR as the code change.
- Stale doc = no doc. A wrong doc is worse than no doc.
- Doc rot = 6+ months untouched. Delete or update.

## README Anatomy

```markdown
# Project Name

[One sentence: what is this?]

## Why

[One paragraph: why does this exist? What problem does it solve?]

## Install

[Exact commands. Tested on a fresh machine.]

## Usage

[Smallest working example.]

## Architecture

[One diagram or paragraph. Link to ARCHITECTURE.md for details.]

## Contributing

[Link to CONTRIBUTING.md. Or inline if small.]

## License

[SPDX identifier.]
```

## Common Mistakes

ADR for every choice (noise); doc that's just code comments copy-pasted; doc written once and never updated; "comprehensive" docs no one reads; ADR without alternatives; runbooks that assume context; no table of contents; mixing levels; outdated examples; missing "Why" section.

## Red Flags

Doc rot (> 6 months); ADR without context or consequences; runbook without commands; README without "Why" or "Install"; no link between doc and code; doc only in chat (lost); "we'll document later"; examples that don't run.

## Anti-Patterns

**ADR for trivial**; **doc without audience**; **stale doc**; **"comprehensive" wall**; **no link to code**; **ADR with no alternatives**.

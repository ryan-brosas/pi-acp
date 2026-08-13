---
purpose: User identity, preferences, approval boundaries, communication and git workflow (on-demand reference; not injected into prompts)
updated: 2026-08-09
---

# User Profile

## Identity

- **Name:** [Name]
- **Role:** [Role]
- **Git contributor identity:** [login / email / profile]

Evidence: [how this was verified, e.g. authenticated gh profile or user statement]

## Communication Preferences

- **Detail level:** [Concise / Detailed / Mixed]
- **Style:** [what the user wants in answers: evidence, structure, examples]
- **Example of preferred answer shape:** [one short worked example the user approved]

## Approval Boundaries

Ask before:

- [Action requiring confirmation, e.g. destructive git operations]
- [Action requiring confirmation, e.g. pushing or opening PRs]
- [Action requiring confirmation, e.g. committing in a dirty repository]

Auto-approve (never ask again):

- [Routine action the user has pre-authorized]

Mark anything not covered `[NEEDS CLARIFICATION: reason]` instead of guessing.

## Git Workflow

- **Commit mode:** [Ask first / Auto-commit completed scoped work]
- **Staging rule:** [e.g. stage only files changed for the active request]
- **Commit style:** [e.g. terse conventional commits: feat:, fix:, docs:, chore:]
- **Push / PR policy:** [when pushing or opening PRs is allowed]
- **Protection rules:** [never force-push shared branches; never bypass hooks]

## Workflow Preferences

- **Starting non-trivial work:** [e.g. evidence-backed discovery plus the Schema loop (`schema.hypothesize → verify → commit`)]
- **Change size:** [e.g. smallest stable slice over broad speculative refactors]
- **Dirty repositories:** [e.g. preserve existing and concurrent work]
- **Navigation:** [semantic navigation before raw text search when source exists]
- **Verification:** [run gates when they exist; explicit structural inspection for prose-only repositories]

## Technical Preferences

- [Languages, frameworks, patterns the user favors]
- [Tools and workflows the user prefers]
- [Explicitly none: state when nothing has been specified; do not infer from host tools]

## Things to Remember

1. [Durable preference or fact 1]
2. [Durable preference or fact 2]

## Unknowns

- [Unanswered profile question] — `[NEEDS CLARIFICATION: reason]`

---

_Update this file when the user states a durable preference._
_Do not store secrets, transient task details, or speculative personal information._

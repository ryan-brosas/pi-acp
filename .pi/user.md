# User Profile

## Identity

- **Name:** [Name]
- **GitHub login:** [login]
- **GitHub profile:** [https://github.com/<login>]
- **Role:** [role]
- **Repository relationship:** [owner / maintainer / contributor]

Evidence: [NEEDS CLARIFICATION: run `gh auth status`, `gh api user`, and `gh repo view` and record the verified profile here.]

## Project Direction

This repository is a clonable Pi + Pi Fabric coding template, originally ported from opencode-template. The intended audience is developers; stability is the primary definition of success.

When proposing work:

- Protect the clone-and-start experience.
- Prefer Pi-native and Pi Fabric-native behavior.
- Treat the inspiration repository as a reference, not a compatibility requirement.
- Explain how a change affects reliability, setup, customization, and maintenance.
- Avoid speculative product expansion that weakens the stable core.

## Communication Preferences

- **Detail level:** [Concise / Detailed / Mixed]
- Include concrete file paths, evidence, constraints, edge cases, and verification results.
- Explain architectural or workflow consequences when they affect future work.
- State uncertainty directly and distinguish observed facts from inference.
- For choices, provide a recommendation and explain the important tradeoff.

Repository AGENTS.md style rules still apply to every response and override softer presentation preferences.

## Approval Boundaries

Ask before:

- Publishing, pushing, or opening a pull request unless the active request or repository workflow authorizes it.
- Committing a change that would include unrelated user or concurrent-agent work.
- Destructive or irreversible git operations (force-push, reset, clean, checkout overwrites).
- Expanding scope beyond the active request.

Auto-approve (pre-authorized):

- Commits of completed, scoped work that pass the relevant verification gate.
- Evidence-backed discovery and read-only analysis.

Anything not listed here is [NEEDS CLARIFICATION: reason] until the user states a policy.

## Git Workflow

- **Commit mode:** [Ask first / Auto-commit completed scoped work]
- Stage only files changed for the active request; never use blanket staging in a dirty repository.
- Do not include unrelated changes in a commit.
- Run the relevant verification gate before committing.
- Use the repository's terse conventional commit style when the history supports it (`feat:`, `fix:`, `docs:`, `chore:`).
- Never force-push shared branches or bypass hooks.

## Workflow Preferences

- Start non-trivial changes with evidence-backed discovery and the Schema loop (`schema.hypothesize → verify → commit`).
- Prefer the smallest stable slice over broad speculative refactors.
- Preserve existing and concurrent work in dirty repositories.
- Verify behavior with commands when a runnable gate exists; use explicit structural inspection for prose-only/configuration repositories.
- Report what was verified locally and what still requires a live or fresh-clone check.

## Technical Preferences

- Pi and Pi Fabric are the preferred agent workflow foundation.
- No language, application framework, database, UI framework, or deployment preference has been specified.
- Host tools installed in the environment are not project preferences; do not infer a preference from them.

## Things to Remember

1. [Durable preference or fact 1]
2. [Durable preference or fact 2]

## Unknowns

- [NEEDS CLARIFICATION: fill identity fields via gh auth status / gh api user / gh repo view]
- [NEEDS CLARIFICATION: confirm role, branch protection, and issue tracker choices]

---

_Update this file when the user states a durable preference._
_Do not store secrets, transient task details, or speculative personal information._

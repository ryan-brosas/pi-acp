# User Profile

## Identity

- **Name:** Ryan Brosas
- **GitHub login:** ryan-brosas
- **GitHub profile:** https://github.com/ryan-brosas
- **Role:** Repository owner
- **Repository relationship:** owner (fork `pi-acp-jetbrain` of pi-acp)

Evidence: verified via `gh api user` (login `ryan-brosas`, id `278091977`, name `Ryan Brosas`), repo-local git identity `Ryan Brosas <278091977+ryan-brosas@users.noreply.github.com>`, and remote `origin` = `https://github.com/ryan-brosas/pi-acp-jetbrain.git`.

## Project Direction

This repository is a clonable Pi + Pi Fabric coding template, originally ported from opencode-template. The intended audience is developers; stability is the primary definition of success.

When proposing work:

- Protect the clone-and-start experience.
- Prefer Pi-native and Pi Fabric-native behavior.
- Treat the inspiration repository as a reference, not a compatibility requirement.
- Explain how a change affects reliability, setup, customization, and maintenance.
- Avoid speculative product expansion that weakens the stable core.

## Communication Preferences

- **Detail level:** Detailed with concrete evidence; concise summaries for completion reports.
- Include concrete file paths, evidence, constraints, edge cases, and verification results.
- Explain architectural or workflow consequences when they affect future work.
- State uncertainty directly and distinguish observed facts from inference.
- For choices, provide a recommendation and explain the important tradeoff.
- Report concrete identifiers verbatim: commit hashes, PR/issue numbers, artifact paths.

Repository AGENTS.md style rules still apply to every response and override softer presentation preferences.

## Approval Boundaries

Ask before:

- Pushing or opening a pull request — never push unless explicitly requested.
- Committing a change that would include unrelated user or concurrent-agent work.
- Destructive or irreversible git operations (force-push, reset, clean, checkout overwrites).
- Expanding scope beyond the active request.

Auto-approve (pre-authorized):

- Commits of completed, scoped work that pass the relevant verification gate — create an atomic, path-scoped commit with a detailed message after successful verification of a mutating request.
- Evidence-backed discovery and read-only analysis.
- The user-installed `scripts/auto-commit.mjs` watcher committing all non-ignored tracked and untracked repository changes after its safety scan (sole exception to path-scoped staging).

Anything not listed here is [NEEDS CLARIFICATION: reason] until the user states a policy.

## Git Workflow

- **Commit mode:** Auto-commit completed scoped work — after successful verification of a mutating request, create an atomic, path-scoped commit automatically with a detailed message describing intent, implementation details, and verification performed.
- **Staging rule:** stage only files changed for the active request; never use blanket staging in a dirty repository. The `scripts/auto-commit.mjs` watcher is the sole exception and may commit all non-ignored tracked and untracked changes after its safety scan (every 60 seconds).
- **Commit style:** detailed conventional commits (`feat:`, `fix:`, `docs:`, `chore:`) with a message body describing intent, implementation details, and verification performed.
- **Push / PR policy:** never push and never open pull requests unless explicitly requested.
- **Protection rules:** never force-push `main`/`master`; never bypass hooks.

## Workflow Preferences

- Start non-trivial changes with evidence-backed discovery and the Schema loop (`schema.hypothesize → verify → commit`).
- Prefer the smallest stable slice over broad speculative refactors.
- Preserve existing and concurrent work in dirty repositories.
- Verify behavior with commands when a runnable gate exists; use explicit structural inspection for prose-only/configuration repositories.
- Run the canonical gate (`node scripts/check.mjs`) plus `npm test`, `npm run lint`, and `npm run typecheck` before reporting completion.
- Report what was verified locally and what still requires a live or fresh-clone check.

## Technical Preferences

- Pi and Pi Fabric are the preferred agent workflow foundation.
- No language, application framework, database, UI framework, or deployment preference has been specified.
- Host tools installed in the environment are not project preferences; do not infer a preference from them.

## Things to Remember

1. GitHub account: `ryan-brosas` (id `278091977`, display name "Ryan Brosas"); repo-local git identity `Ryan Brosas <278091977+ryan-brosas@users.noreply.github.com>`; origin `https://github.com/ryan-brosas/pi-acp-jetbrain.git`; no commit signing key.
2. Auto-commit watcher: `scripts/auto-commit.mjs` under user systemd service `pi-acp-auto-commit.service` — commits all non-ignored changes every 60 seconds, blocks commits on likely secrets, never pushes.
3. Never push and never open pull requests unless explicitly requested.

## Unknowns

- Branch protection rules on `origin/main` — not verified (no push has been performed from this checkout).
- Issue tracker / project board choices — not specified.

---

_Update this file when the user states a durable preference._
_Do not store secrets, transient task details, or speculative personal information._

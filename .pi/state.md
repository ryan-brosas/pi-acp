# State

## Current Position

- **Date:** 2026-08-13
- **Project:** `ryan-brosas/pi-acp` (JetBrains IntelliJ primary host)
- **Phase:** Template layer adoption
- **Status:** In progress
- **Active focus:** Import the pi-template operating layer (.pi/prompts, skills, templates, check gate) into this repository and adapt the context artifacts.
- **Primary success criterion:** `node scripts/check.mjs` exits 0 in this repository.

## Working Tree Context

- The IntelliJ workspace clone (branch `feat/intellij-mcp-stdio-bridge`, uncommitted `.idea/` changes; do not stage or revert them).
- The canonical dev/push clone (branch `main` at `f6e5ab2`, pushed to `ryan-brosas/pi-acp` `main`; upstream `svkozak/pi-acp` is read-only, no PRs per user direction).
- IntelliJ launches the adapter from the dev clone's `dist/index.js` (see `~/.jetbrains/acp.json`).
- The template layer was imported on 2026-08-13: `.pi/prompts`, `.pi/skills`, `.pi/templates`, `.pi/settings.json`, `.pi/work`, validator scripts, `.github/workflows/check.yml`, and adapted `project.md`/`roadmap.md`/`fabric.json`/`AGENTS.md`.
- Environment facts: Node.js v26.7.0 available; npm toolchain for the adapter build.

## Verification State

| Gate | Command | Last result | Date |
| --- | --- | --- | --- |
| Adapter tests | `npm test` | pass, 139 tests | 2026-08-13 |
| Lint | `npm run lint` | pass | 2026-08-13 |
| Typecheck | `npm run typecheck` | pass | 2026-08-13 |
| Live IntelliJ probe | headless ACP client | SSE connect, 58 tools, semantic call, clean teardown | 2026-08-13 |
| Canonical check | `node scripts/check.mjs` | pending first run in this repository | 2026-08-13 |

## Recent Completed Work

| Date | Work | Evidence |
| --- | --- | --- |
| 2026-08-13 | MCP-over-SSE transport with SSE-first preference | Commit `15e6f27`, live probe `connected over SSE; 58 tools` |
| 2026-08-13 | Session-scoped diagnostics + teardown hardening | Commit `5a6e0e4` |
| 2026-08-13 | Docs: JetBrains primary host, harness state ignored | Commits `70813b9`, `f6e5ab2` |
| 2026-08-13 | Imported pi-template operating layer | This workspace, uncommitted |

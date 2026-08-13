# State

## Current Position

- **Date:** 2026-08-13
- **Project:** `ryan-brosas/pi-acp` (JetBrains IntelliJ primary host)
- **Phase:** JetBrains IDE integration and adapter hardening
- **Status:** Active — adapter gates green (142 tests), workspace consolidated, auto-commit watcher active
- **Active focus:** Lifecycle hardening (bounded pi RPC deadlines, clean subprocess shutdown) and release hygiene.
- **Primary success criterion:** `node scripts/check.mjs` exits 0 in this repository.

## Working Tree Context

- This checkout (`main`) is the single workspace; IntelliJ launches the adapter from this checkout's `dist/index.js` (see `~/.jetbrains/acp.json`, backup `~/.jetbrains/acp.json.bak-20260814-043435`).
- Upstream `svkozak/pi-acp` is read-only; no PRs per user direction. Local commits on `main` are unpushed until explicitly requested.
- The template layer was imported on 2026-08-13: `.pi/prompts`, `.pi/skills`, `.pi/templates`, `.pi/settings.json`, `.pi/work`, validator scripts, `.github/workflows/check.yml`, and adapted `project.md`/`roadmap.md`/`fabric.json`/`AGENTS.md`.
- Environment facts: Node.js v26.7.0 available; npm toolchain for the adapter build.

## Verification State

| Gate                | Command                  | Last result                                          | Date       |
| ------------------- | ------------------------ | ---------------------------------------------------- | ---------- |
| Adapter tests       | `npm test`               | pass, 142 tests                                      | 2026-08-14 |
| Lint                | `npm run lint`           | pass                                                 | 2026-08-13 |
| Typecheck           | `npm run typecheck`      | pass                                                 | 2026-08-13 |
| Live IntelliJ probe | headless ACP client      | SSE connect, 58 tools, semantic call, clean teardown | 2026-08-13 |
| Canonical check     | `node scripts/check.mjs` | pass                                                 | 2026-08-14 |

## Recent Completed Work

| Date       | Work                                                                       | Evidence                                                                                   |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 2026-08-13 | MCP-over-SSE transport with SSE-first preference                           | Commit `15e6f27`, live probe `connected over SSE; 58 tools`                                |
| 2026-08-13 | Session-scoped diagnostics + teardown hardening                            | Commit `5a6e0e4`                                                                           |
| 2026-08-13 | Docs: JetBrains primary host, harness state ignored                        | Commits `70813b9`, `f6e5ab2`                                                               |
| 2026-08-13 | Imported pi-template operating layer                                       | This workspace, uncommitted                                                                |
| 2026-08-14 | JetBrains IDE generalization, workspace consolidation, lifecycle hardening | Commits `48f76d2`, `f0101a7`, `09b9298`; lifecycle-hardening change (deadlines + shutdown) |

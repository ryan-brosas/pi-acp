# Project

Rendered by /init from .pi/templates/project.md (adapted 2026-08-13 when the pi-template layer was imported into this repository). Read on demand for project context; update when architecture or direction changes.

## Purpose and Status

- **Goal:** An ACP (Agent Client Protocol) adapter that bridges JetBrains IntelliJ's ACP host to the `pi` coding agent (`@earendil-works/pi-coding-agent`) without modifying pi — one pi subprocess per ACP session, with IntelliJ's private IDE MCP server exposed to pi as `ide_<server>_<tool>` tools.
- **Status:** Functional and verified end to end. The IntelliJ path connects over SSE (transport=sse), registers the full IDE tool catalog with pi, and pi invokes IDE tools through the bridge. Primary host is JetBrains IntelliJ; other ACP clients are best-effort.
- **Milestone:** MCP-over-SSE transport with SSE-first preference (2026-08-13), session-scoped bridge diagnostics, teardown hardening, 139 unit tests green. Evidence: live IntelliJ probe (`connected over SSE; 58 tools registered`), `node scripts/check.mjs` exit 0.
- **Milestone:** JetBrains IDE generalization (2026-08-14): user-facing guidance labels JetBrains IDE (wire `IJ_MCP_*` semantics unchanged), capability-subset test for IntelliJ IDEA/WebStorm/PyCharm/Rider, completion gate requires IDE inspections + independent review (no unresolved P0/P1), deployed adapter repointed to this checkout (`48f76d2`), 140 unit tests green.
- **Next Milestone:** See .pi/roadmap.md.

## Success Criteria

1. A new IntelliJ chat gets `ide_*` tools registered with pi and pi can invoke them (verifiable via startup info "IDE Tools" section and tool_call events).
2. `npm test` (140 tests), `npm run lint`, `npm run typecheck`, and `npm run build` all pass; `node scripts/check.mjs` exits 0 for the template layer.
3. Session teardown leaves no orphan pi/MCP processes (SIGKILL escalation, deduped close).
4. The adapter never blocks `session/new` on a silent MCP server (bounded discovery timeouts).

## Target Users

- **Primary:** JetBrains IntelliJ users running pi as an ACP agent inside the IDE.
- **Secondary:** ACP client developers (Zed, others) needing a pi adapter.
- **Non-goals:** Client-side ACP FS/terminal delegation (pi works locally); modifying pi itself.

## Core Principles

1. **Session isolation.** 1 ACP session = 1 pi subprocess; no shared mutable bridge state across sessions.
2. **JetBrains-first.** IntelliJ is the primary host; the bridge prefers the IDE's in-process SSE endpoint (`IJ_MCP_SERVER_PORT`) over the launcher-based stdio descriptor that forwards-and-exits.
3. **Bounded everything.** Discovery, runtime calls, and startup each have explicit deadlines; silent servers never block session creation.
4. **The Schema guard is the mutation authority.** Non-trivial writes require `schema.hypothesize → verify → commit` in one `fabric_exec` under enforce mode; under audit mode each mutation requires explicit user approval. (AGENTS.md Mutation Authority, .pi/fabric.json.)
5. **Graceful degradation.** Unavailable MCP servers become diagnostics, not session failures.

## System Context

- **External actors:** The IntelliJ ACP host (supplies per-chat MCP descriptors and the in-process IDE MCP server); the pi coding-agent runtime; the ACP client over stdio.
- **External systems:** IntelliJ's private MCP server (HTTP+SSE on `IJ_MCP_SERVER_PORT`), pi `--mode rpc` subprocesses, the pi extension host (`src/pi-extension/acp-mcp-bridge.ts`), and the Git remote at `origin https://github.com/ryan-brosas/pi-acp.git` (fork; upstream svkozak/pi-acp is read-only).
- **Trust boundaries:** MCP servers are spawned from the session cwd; the bridge validates catalogs, schema hashes, and per-tool registration acks. IntelliJ's `idea_mcp_allowed_tools` allowlist is applied IDE-side; do not silently assume AllowAll.
- **Runtime and environment:** Node.js 22+, pi v0.80.4+, npm for the adapter's own build/test toolchain.

## Architecture Overview

- **Architectural style:** Layered stdio adapter: ACP JSON-RPC (SDK) → session layer → pi RPC subprocess; plus a session-owned MCP bridge (stdio/ACP/SSE transports) exposing `ide_*` tools over authenticated per-session IPC to a pi extension.
- **Component Responsibilities:**
  - `src/acp/*` — ACP protocol handling: agent, session lifecycle, MCP bridge (`mcp-bridge.ts`), transports (`mcp-stdio.ts`, `mcp-sse.ts`), IPC adapter (`mcp-ipc.ts`), session store, settings/sessions helpers.
  - `src/pi-rpc/*` — pi subprocess wrapper: spawn, newline-delimited JSON, abort, teardown with SIGKILL escalation.
  - `src/pi-extension/acp-mcp-bridge.ts` — in-pi extension: IPC client, JSON Schema → TypeBox conversion, `ide_<server>_<tool>` tool registration.
  - `test/unit|component` — node:test suites (139 tests); `scripts/smoke-*.mjs` — headless ACP end-to-end probes.
  - `.pi/prompts|skills|templates` — the imported pi-template operating layer (9 slash commands, progressive-disclosure skill packs, document templates).
  - `scripts/check.mjs` + validators — template-layer canonical gate.
- **Dependency Rules:** The bridge never imports the ACP session layer; the pi extension only speaks the IPC wire protocol; transports share `#initializeAndDiscover` (bounded initialize → initialized → tools/list).

## Runtime Entrypoints

| Entrypoint                                                          | Kind              | Path         | Purpose                                    | Config source                   |
| ------------------------------------------------------------------- | ----------------- | ------------ | ------------------------------------------ | ------------------------------- | ------ | ------------------------- | ----------------------------------- |
| dist/index.js                                                       | ACP agent         | src/index.ts | ACP server: initialize, session/new        | load                            | prompt | cancel, MCP bridge wiring | ~/.jetbrains/acp.json agent_servers |
| --terminal-login                                                    | CLI flag          | src/index.ts | Interactive pi login/setup from a terminal | ACP authMethods                 |
| /init, /create, /plan, /fix, /ship, /verify, /audit, /gc, /research | Pi slash commands | .pi/prompts/ | pi-template workflows                      | .pi/templates/, .pi/fabric.json |

## Request, Data, and Event Flows

- **Primary request flow:** IntelliJ chat → ACP `session/new` (cwd, mcpServers) → adapter spawns pi, starts the MCP bridge (SSE-first when `IJ_MCP_SERVER_PORT` is advertised) → bridge registers tools with the pi extension → startup info lists acknowledged tools → `session/prompt` streams pi events as `session/update`.
- **Write and read paths:** Pi edits files locally (no ACP fs delegation); tool locations and structured diffs are emitted for ACP clients that support them.
- **Failure behavior:** A failed transport attempt falls back (SSE → stdio) or degrades to a diagnostic; a failed Schema commit blocks all writes.

## Configuration

- **Configuration sources:** `~/.jetbrains/acp.json` (host wiring), `PI_ACP_PI_COMMAND`, `PI_ACP_DEBUG_BRIDGE`, `PI_ACP_ENABLE_EMBEDDED_CONTEXT` env vars, `.pi/settings.json` (pi runtime), `.pi/fabric.json` (Schema guard).
- **Secrets:** None committed; MCP auth tokens are per-chat descriptor env and are never logged in full.
- **Environments:** Local development only; `dist/` is the deployable artifact.

## Data Ownership

- **Stores and schemas:** `~/.pi/pi-acp/session-map.json` (ACP session → pi session mapping); pi's own session files under `~/.pi/agent/sessions/`. Evidence: `src/acp/session-store.ts`, `src/acp/pi-sessions.ts`.
- **Generated state:** `.pi/MEMORY.md`, `.pi/implementation-notes.md`, `.pi/fabric/`, `.pi/work/` local pointers and progress logs — gitignored, runtime-owned. Evidence: `.gitignore`.

## External Integrations

| Service                        | Auth                                          | Evidence                                         | Rate limits                          | Error handling                                    |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------ | ------------------------------------ | ------------------------------------------------- |
| JetBrains IntelliJ private MCP | Per-chat `IJ_MCP_AUTH_TOKEN` when supplied    | `src/acp/mcp-bridge.ts`, `~/.jetbrains/acp.json` | Localhost; bounded adapter deadlines | SSE-first, stdio fallback, diagnostic degradation |
| pi coding agent                | Local process/configured provider credentials | `src/pi-rpc/process.ts`, `PI_ACP_PI_COMMAND`     | Provider-dependent                   | startup/runtime errors mapped to ACP updates      |
| GitHub fork                    | gh HTTPS token                                | `git remote get-url origin`, `gh repo view`      | GitHub limits                        | fork-only push by user direction                  |

## Deployment Topology

- **Build artifacts:** `dist/index.js` plus sourcemaps and the pi extension bundle, generated by `npm run build` (`tsup.config.ts`).
- **Runtime services:** IntelliJ launches the adapter as an ACP stdio process; the adapter launches one pi RPC subprocess per session and connects to IntelliJ's localhost MCP endpoint.
- **Environments:** local development/distribution through npm; no staging environment is configured (`package.json`, `.github/workflows/npm-publish.yml`).
- **Health checks:** no endpoint; use ACP `initialize`/`session/new`, startup info, and smoke probes.
- **Rollback path:** install/repoint a prior `dist/index.js` or git revision; no automated rollback is configured.

## Testing Architecture

- **Unit + component:** `npm test` (node:test via tsx) — 139 tests at fork `main` (`f6e5ab2`): ACP translation, session lifecycle, bridge (stdio/SSE/fallback ordering), SSE client, IPC handshake, startup info. The workspace checkout (`e17ed85`) runs 118 tests (pre-SSE tree).
- **End-to-end:** `scripts/smoke-*.mjs` (headless ACP client) and live IntelliJ probes (real IDE MCP server on the advertised port).
- **Canonical gate:** `node scripts/check.mjs` — seven structural validators for the template layer + `git diff --check`; also runs in `.github/workflows/check.yml`.
- **Command status (verified 2026-08-13, workspace checkout):** build pass, test pass (118), lint pass, typecheck pass, canonical check pass (111 oks). The four init artifacts pass a scoped Prettier check; the repository-wide write-mode formatter was not run.
- **Coverage gaps:** no ACP-host integration test suite beyond smoke probes; IntelliJ-specific behavior is covered by manual live probes.

## Observability

- **Logging:** adapter/bridge diagnostics go to stderr; IntelliJ captures them in `idea.log`. Session startup info includes transport, discovered/registered/failed tool counts (`src/acp/agent.ts`, `PI_ACP_DEBUG_BRIDGE`).
- **Metrics:** none exported.
- **Tracing:** ACP session IDs and MCP connection/request IDs provide local correlation; no distributed tracing.
- **Alerting:** none; failures surface in startup info, ACP updates, tests, or smoke probes.

## Failure Modes

| Failure                                  | Symptom                       | Detection                    | Recovery                                                                   |
| ---------------------------------------- | ----------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| IntelliJ launcher forwards stdio command | Child exits 0, no MCP traffic | Bridge diagnostic `code=0`   | SSE-first preference: never spawn the launcher when the port is advertised |
| SSE endpoint stale                       | Connect refused/timeout       | `SSE unavailable` diagnostic | Fall back to stdio attempt                                                 |
| Silent MCP server                        | `session/new` would hang      | Bounded discovery test       | Diagnostic + continue                                                      |
| Orphan pi process                        | Adapter killed, child alive   | direct `pgrep -P` probe      | SIGTERM then SIGKILL escalation in `PiRpcProcess.waitForExit`              |

## Architectural Invariants

- 1 ACP session ↔ 1 pi subprocess; bridge state is session-scoped (`src/acp/session.ts`, `src/acp/mcp-bridge.ts`).
- No ACP client-side FS/terminal delegation in the MVP (`README.md` Limitations).
- The catalog is immutable for the session; changing IntelliJ MCP settings requires a new chat.
- Skill membership is owned by `.pi/skills/packs.json`; the canonical check enforces manifest parity.
- Generated local state stays untracked (`.gitignore`).

## Decisions

| Date       | Decision                                                    | Rationale                                               | Alternatives                  | Record                                  |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------- | ----------------------------- | --------------------------------------- |
| 2026-08-13 | SSE-first when `IJ_MCP_SERVER_PORT` is advertised           | Avoid launcher forwarding/stray buffers; faster startup | stdio-first then SSE          | fork commit `15e6f27`                   |
| 2026-08-13 | Bounded cursor-paginated discovery shared across transports | Silent clients must never block `session/new`           | unbounded discovery           | `test/unit/mcp-bridge.test.ts`          |
| 2026-08-13 | JetBrains IntelliJ is the primary documented host           | Explicit user direction                                 | Zed-first/general positioning | session decision; fork commit `f6e5ab2` |
| 2026-08-13 | Import pi-template operating layer                          | Reuse prompts, skills, templates, and gates             | maintain ad hoc project rules | `.pi/`, `scripts/check.mjs`             |

## Known Risks and Hotspots

- The IntelliJ workspace checkout is stale (`e17ed85`) relative to fork `main` (`f6e5ab2`), so source claims must use the dev clone until roadmap Phase 2.
- `src/acp/mcp-bridge.ts` and session teardown are the highest-coupling paths; transport order, cancellation, registration, and disposal need regression tests.
- IntelliJ's private MCP/SSE contract is not a public compatibility guarantee.

## Open Questions

| Question                                                               | Context                       | Blocking | Priority |
| ---------------------------------------------------------------------- | ----------------------------- | -------- | -------- |
| What version/release policy should the JetBrains-focused fork use?     | No policy in README/workflows | no       | medium   |
| Should SSE reconnect after IDE restart/reindex, or require a new chat? | Roadmap Phase 4               | no       | medium   |

## Evidence

- Project manifest and commands: `package.json`, `tsconfig.json`, `tsup.config.ts`.
- Architecture: `src/index.ts`, `src/acp/*`, `src/pi-rpc/*`, `src/pi-extension/*`.
- Gates: `scripts/check.mjs`, `.github/workflows/check.yml`, command output recorded in `.pi/state.md`.
- Host wiring: `~/.jetbrains/acp.json`; live probe evidence summarized in `.pi/state.md`.

---

_Update this file when architecture or project direction changes._

# Project status

**Project:** pi-acp-jetbrain
**Updated:** 2026-08-15
**State:** `v0.0.38` published to npm with signed provenance; F-036 nested-pi IPC hardening and F-037 Qodana/JSON-RPC audit remediation are committed and verified. Fresh-host acceptance (F-033) and Windows CI coverage remain open.

## Latest validation (2026-08-15)

- Tests 293/293 (plus audit-regression additions), lint, typecheck, build, canonical check: PASS.
- `v0.0.37` published via GitHub Actions (`Publish Package` on the `v0.0.37` tag, run `31858905710`), signed provenance in sigstore log `2471995135`; GitHub release created.
- Audit remediation: session-map writes are serialized across adapter processes (dependency-free sibling lock with stale recovery); the MCP `clientInfo` version now mirrors the package version; protocol-boundary `any` declarations narrowed to typed access; README/STATUS refreshed.
- `dogfood:report` 15/15 probes OK (run 1 had an intermittent `smoke-cancel` 60 s prompt timeout; instrumented in D-1).
- `dogfood:ide` preflight: config wired to this checkout; 6 stale adapter PIDs predate the dist rebuild.
- Live bridge (`ide_idea_*`) read/search/discovery/lint all work; 0 IDE problems on changed files.
- D-1 implemented in `scripts/smoke-cancel.mjs` (commit `282ff7b`): phase-consistent 240 s deadline, `cancel latency` reporting (measured 42 ms), failure diagnostics.
- Full evidence: `docs/findings/2026-08-15-pi-acp-extension-dogfood-stability.md`.

## Next steps

- Start a fresh IntelliJ chat after the next dist rebuild and complete the F-033 checklist (new PID, build revision match, cancel/restore/shutdown).
- Add Windows CI coverage (check.yml currently runs Linux only; Windows paths and named-pipe logic stay untested).

## F-036: nested-pi IPC guard (fixed)

- Fixed: IPC frames and socket close arriving while the pi extension runtime is still loading
  (a nested `pi` inheriting a live adapter's `PI_ACP_MCP_IPC_*` env) now defer instead of
  crashing: `setPolicyFiltering`/`activateIdeTools` retry until the runtime is ready, and the
  `hello_ack` branch probes readiness before registering tools. Covered by two unit tests
  (`defers policy filtering until the pi runtime is ready...`, `defers catalog registration
when hello_ack arrives during extension loading`).

## F-037: Qodana was analyzing the wrong language (fixed)

- `qodana.yaml` pinned `qodana-jvm-community` (the free JVM linter), so CI pulled the JVM image
  and reported "0 problem detected" against this TypeScript repo (run `31858985179`). No JS/TS
  community linter exists (docs list only jvm/python community images); switched to the WebStorm-
  based `qodana-js`, which requires `QODANA_TOKEN` (already wired in the workflow). Next Qodana
  run will analyze TypeScript for real.
- Local proxy for the same engine: `ide_idea_lint_files` across `src/` (28 files) found 8 real
  findings; fixed the duplicated JSON-RPC settlement block shared by `mcp-sse.ts`/`mcp-stdio.ts`
  via a new `src/acp/mcp-json-rpc.ts` helper (`settlePendingJsonRpcResponse`, 3 unit tests) and
  marked the four immutable `McpIpcServer` identity fields `readonly`. Remaining findings are
  intentional (rethrow-after-bookkeeping SSE reader, infinite read loop, fire-and-forget cancel
  notification, simplifiable catch-if in `agent.ts`). 197 "Unterminated statement" warnings are
  Prettier `semi: false` false positives. Test `any` debt (102) deferred.
- In the fresh chat, dogfood the enforced IntelliJ-first path: edits must go through `ide_idea_apply_patch`/`ide_idea_create_new_file`; a direct `pi.write`/`schema.commit` inside `fabric_exec` must be blocked by the tool_call gate, and any file changed without an IDE mutation event must surface as a `Mutation provenance` violation.
- Note: `docs/` is gitignored — findings docs are local-only evidence.

## Commands

- `npm test` · `npm run lint` · `npm run typecheck` · `npm run build`
- `npm run dogfood:report` · `npm run dogfood:ide`

## Release status (2026-08-15)

- `v0.0.38` **published**: `pi-acp-jetbrain@0.0.38` is npm `latest` (run `31871255871`, tag
  `v0.0.38` -> `6bc5837`), signed provenance in sigstore log `2473524305`; GitHub release
  https://github.com/ryan-brosas/pi-acp-jetbrain/releases/tag/v0.0.38.
- Publishing uses npm trusted publishing over GitHub OIDC; no `NPM_TOKEN` secret is needed.
  The classic-token guard and `NODE_AUTH_TOKEN` override added in `d68f4e0`/`c593776` were
  removed from both `npm-publish.yml` and `release.yml` (`6bc5837`) — they contradicted the
  README OIDC path and failed once the secret was deleted.

## Gotchas

- A rebuilt `dist` does not reload already-running IntelliJ-owned adapter processes.
- `docs/` is gitignored; only `STATUS.md` is committed.

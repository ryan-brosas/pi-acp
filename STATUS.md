# Project status

**Project:** pi-acp-jetbrain
**Updated:** 2026-08-15
**State:** `v0.0.37` published to npm with signed provenance; audit remediation for the concurrent session map, MCP client version, boundary typing, and release docs is committed and verified. Fresh-host acceptance (F-033) and Windows CI coverage remain open.

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
- In the fresh chat, dogfood the enforced IntelliJ-first path: edits must go through `ide_idea_apply_patch`/`ide_idea_create_new_file`; a direct `pi.write`/`schema.commit` inside `fabric_exec` must be blocked by the tool_call gate, and any file changed without an IDE mutation event must surface as a `Mutation provenance` violation.
- Note: `docs/` is gitignored — findings docs are local-only evidence.

## Commands

- `npm test` · `npm run lint` · `npm run typecheck` · `npm run build`
- `npm run dogfood:report` · `npm run dogfood:ide`

## Gotchas

- A rebuilt `dist` does not reload already-running IntelliJ-owned adapter processes.
- `docs/` is gitignored; only `STATUS.md` is committed.

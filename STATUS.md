# Project status

**Project:** pi-acp-jetbrain
**Updated:** 2026-08-15
**State:** `v0.0.39` published to npm with signed provenance; zero-finding Inspect Code sweep, validator fail-closed fix, and second-export disposition are committed and verified (independent release review: no P0/P1/P2 findings; full smoke matrix 16/16). Fresh-host acceptance (F-033) and Windows CI coverage remain open.

## 2026-08-15 WebStorm inspection cleanup

- Ran the full WebStorm inspection sweep (41 findings across 15 files, warnings
  and weak warnings) and addressed every actionable finding: fixed real
  type/control-flow/regex findings in `src/acp/{agent,mcp-sse}.ts` and the dev
  scripts, removed accidental `untitled/src/Main.java` and `src/Main.kt` starter
  templates, and deduplicated shared scaffolding (`scripts/lib/validate-common.mjs`,
  `scripts/fixtures/fake-mcp-stdio.mjs`, and the `connectIpc`/`connectRaw`,
  `makeSession`/`flush`/`assertToolCall` test helpers).
- One finding remains and is a verified WebStorm dataflow false positive: the
  `if (sessionId)` cleanup branch in the `agent.ts` fork path (WebStorm concludes
  the try cannot throw once `sessionId` is assigned, but the post-registration
  awaits — bridge readiness, session release, config — can throw). Documented
  in-code; the IDE `lint_files` tool ignores `// noinspection` comments.
- Verified: 299/299 tests, ESLint, typecheck, build, canonical check, prettier.

## 2026-08-15 inspection-export sweep (second pass)

The full WebStorm Inspections panel was exported to `inspection/` (211 findings:
28 Annotator errors, 32 unused-global-symbol warnings, 17 grammar, 13 style,
2 markdown-table, 118 spelling, 1 pointless-boolean).

- Fixed the 28 Annotator errors: the IDE misparsed an intentionally abbreviated
  ```ts snippet (`types.gen.d.ts` excerpt with U+2026 ellipses) in the research
  doc; fence changed to ```text. Verified `errors: []` on the file.
- Removed 5 genuinely dead symbols: `StdioMcpClient.requestWithId` (superseded by
  `request()`), `findPiSessionFile` (unused wrapper), `Session.bridgeTools` getter
  (superseded by `bridgeRegisteredTools`), `PiRpcProcess.consumePreludeLines` and
  `switchSession` (never called). Typecheck + 43 targeted tests + IDE lint clean.
- Documented as inspection false positives / intentional (no code change): the
  `unstable_*` agent methods and `Session.closeAllExcept` (dynamic/duck-typed
  dispatch), 25 test-helper findings (structural interface implementations),
  the Grazie grammar/style suggestions (cosmetic; "IntelliJ IDE" is intentional —
  the adapter also serves WebStorm), all 118 spelling findings (intentional
  terms/paths/names, none in committed prose), the 2 markdown-table weak warnings
  (tables are valid CommonMark), and the known agent.ts:1255 false positive.

## 2026-08-15 inspection final run (inspections/)

Re-scan after the dead-code removals: **421 findings, 0 errors** — the 28
Annotator errors are cleared (fence fix verified; `get_file_problems` →
`errors: []`; no Annotator.xml in the export).

- 340 spelling: 222 are the scan flagging the OLD gitignored
  `inspection/SpellCheckingInspection.xml` export itself (meta-noise); the
  ~90 tracked-file hits are the documented intentional terms.
- 31 unused symbols: 2 documented dynamic-dispatch false positives
  (`unstable_setSessionModel`, `closeAllExcept`) + 29 structural test-helper
  interface impls; the 5 dead symbols removed earlier are gone from the list.
- 17+13 Grazie grammar/style: cosmetic suggestions (unchanged).
- 11 CheckTagEmptyBody + 6 HttpUrlsUsage: all on the gitignored
  `inspection/.descriptions.xml` (the scan now covers ignored files) — meta.
- 2 markdown-table + 1 pointless-boolean: known false positives.

`inspections/` (plural) is the new export plus the user's custom inspection
gate: `README.md` + `no-any.inspection.kts` stay tracked (repo content for the
post-turn gate); the `.xml` exports are ignored like `inspection/`.

Note: WebStorm's `run_inspection_kts` bridge cannot currently register
`localInspection` scripts — even the IDE's own generated template returns
`No inspection created after compilation` — so the gate surfaces a
`custom inspections degraded` diagnostic until the WebStorm KTS runtime
supports it (expected to work under IntelliJ/Qodana per the README).

## 2026-08-15 zero-finding sweep (Inspections panel)

Goal: a clean Whole Project → Inspect Code run, not just zero errors.

- WebStorm scope fixed (local, `.idea/`, gitignored): `.idea/pi-acp.iml` now
  excludes `.git`, `.idea`, `.junie`, `.pi`, `.qodana-local`, `.veda`, `dist`,
  `docs`, `inspection`, `inspections`, `node_modules`, `untitled`;
  `.idea/dictionaries/pi_acp.xml` registers 42 legitimate project terms
  (jsonrpc, xdebug, tsup, xhigh, …) so spell-checking stays on for real prose.
- Generated export noise removed: all 17 stale `inspection/*.xml` +
  `inspections/*.xml` deleted (untracked); `inspections/README.md` +
  `no-any.inspection.kts` kept.
- Prose/grammar/style fixes across README, 4 smoke scripts, 6 src files, and
  5 component tests (Grazie suggestions, "canceled" spelling, sentence splits
  in `mcp-sse.ts`/`mcp-bridge.ts`).
- 30 structural/dynamic members marked `// noinspection JSUnusedGlobalSymbols`
  (test doubles, `unstable_setSessionModel`, `closeAllExcept`).
- Corrected the `agent.ts:1254` suppression ID to the true inspection class
  `PointlessBooleanExpressionJS` — the old `IfStatementCanBeSimplifiedJS` ID
  was why the 1255 finding persisted; bridge `lint_files` on `agent.ts` is
  now `{"items":[]}`.
- Verified: 299/299 tests, lint, typecheck, prettier, canonical check;
  `lint_files` clean on all changed files (the two large files return partial
  `problems:[]` with `timedOut:true` — tool deadline; all changes comment-only).

## Latest validation (2026-08-15): second export disposition ("it's not 0")

User re-ran Inspect Code; the export landed in a NEW dir `inspirations/` (a
typo-variant of the export path), which was unignored and unexcluded. Findings:
145 (down from 421) with NO node_modules/dist/inspection recursion. Disposition:

- **8 `JSUnusedGlobalSymbols`** — the `proc:` object-literal `noinspection`
  comments do NOT bind (property-level comments are ignored); moved all 4 to the
  statement level (`const session = {`), the proven pattern (same as the
  working `const pi = {` in acp-mcp-extension.test.ts).
- **125 SpellChecking** — every flagged token is covered by the 41-word project
  dictionary (jsonrpc, xdebug, xhigh, tsup, …); the dictionary file is valid but
  the IDE had not loaded it yet (project reload needed).
- **9 GrazieInspection + 1 GrazieStyle + 2 Markdown tables** — all fixed:
  JSONL capitalization false-positives reworded ("session log"/"JSON Lines"),
  "(best effort)" → "on a best-effort basis", "every scripts/" reworded,
  docs prose/table width-aligned to the README format.
- **Scope leak** — `docs/` (19) and `.veda` (6) findings persist because the
  `.iml` excludeFolder entries (docs, .veda, …) only take effect after the
  project reloads; node_modules/dist never appear (default JS exclusions).
- **Watcher hazard** — the auto-commit watcher had committed the volatile
  `inspirations/*.xml` exports; untracked via `git rm --cached` and deleted;
  `.gitignore` (`inspirations/`) and the `.iml` now cover the export dir.

Verified: 299/299 tests, lint, typecheck, prettier, canonical check;
`lint_files` clean on all changed files.

**User action required:** File → Reload All from Disk (or reopen the project)
so the `.iml` exclusions and project dictionary load, then re-run Whole Project
→ Inspect Code — expect 0 findings.

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

- `qodana.yaml` originally pinned `qodana-jvm-community`, so CI reported "0 problem detected"
  against this TypeScript repo (run `31858985179`). Switching to the WebStorm-based `qodana-js`
  then failed on the license: "Your Qodana Cloud organization has Community license that doesn't
  support 'Qodana for JS' linter" (runs `31870730024`, `31870874507`, `31871194563`,
  `31871338288`). JetBrains' license matrix marks JavaScript and TypeScript as Ultimate/Ultimate
  Plus only; Community covers JVM, Android, Python, .NET, C/C++. `qodana.yaml` stays on
  `qodana-jvm-community` (gate green, but not a TS scan); the real TypeScript baseline is the
  per-turn IntelliJ inspection (`ide_idea_lint_files`), which found the 8 real findings fixed
  below. Enabling `qodana-js` requires a Qodana Ultimate/Ultimate Plus license on the `pi-acp`
  Cloud org.
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

- `v0.0.39` **published**: `pi-acp-jetbrain@0.0.39` is npm `latest` (Publish Package
  run `31882152305`, tag `v0.0.39` -> `ba43ecb`), signed provenance over GitHub OIDC; GitHub release
  https://github.com/ryan-brosas/pi-acp-jetbrain/releases/tag/v0.0.39.
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

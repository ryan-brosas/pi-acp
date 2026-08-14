# Project status

**Project:** pi-acp-jetbrain
**Updated:** 2026-08-15
**State:** Dogfood stability validation complete at `e590678`. Verdict: stable for continued dogfooding; D-1 cancel diagnostics implemented; fresh-host acceptance (F-033) is the only open item.

## Latest validation (2026-08-15)

- Tests 283/283, lint, typecheck, build, canonical check: PASS.
- `dogfood:report` 15/15 probes OK (run 1 had an intermittent `smoke-cancel` 60 s prompt timeout; instrumented in D-1).
- `dogfood:ide` preflight: config wired to this checkout; 6 stale adapter PIDs predate the dist rebuild.
- Live bridge (`ide_idea_*`) read/search/discovery/lint all work; 0 IDE problems on changed files.
- D-1 implemented in `scripts/smoke-cancel.mjs` (commit `282ff7b`): phase-consistent 240 s deadline, `cancel latency` reporting (measured 42 ms), failure diagnostics.
- Full evidence: `docs/findings/2026-08-15-pi-acp-extension-dogfood-stability.md`.

## Next steps

- Start a fresh IntelliJ chat after the next dist rebuild and complete the F-033 checklist (new PID, build revision match, cancel/restore/shutdown).
- Note: `docs/` is gitignored — findings docs are local-only evidence.

## Commands

- `npm test` · `npm run lint` · `npm run typecheck` · `npm run build`
- `npm run dogfood:report` · `npm run dogfood:ide`

## Gotchas

- A rebuilt `dist` does not reload already-running IntelliJ-owned adapter processes.
- `docs/` is gitignored; only `STATUS.md` is committed.

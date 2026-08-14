# Project status

**Project:** pi-acp-jetbrain
**Updated:** 2026-08-15
**State:** Dogfood stability validation complete at `544c6f6`.

## Latest validation (2026-08-15)

- Tests 283/283, lint, typecheck, build: PASS.
- `dogfood:report` 15/15 probes OK (run 1 had an intermittent `smoke-cancel` 60 s prompt timeout; not reproducible).
- `dogfood:ide` preflight: config wired to this checkout; 6 stale adapter PIDs predate the dist rebuild.
- Live bridge (`ide_idea_*`) read/search/discovery/lint all work; 0 IDE problems on changed files.
- Full evidence: `docs/findings/2026-08-15-pi-acp-extension-dogfood-stability.md`.

## Next steps

- Start a fresh IntelliJ chat after the next dist rebuild and complete the F-033 checklist (new PID, build revision match, cancel/restore/shutdown).
- Monitor `smoke-cancel`; consider a cancel-latency probe or per-phase deadline budget.
- Note: `docs/` is gitignored — findings docs are local-only evidence.

## Commands

- `npm test` · `npm run lint` · `npm run typecheck` · `npm run build`
- `npm run dogfood:report` · `npm run dogfood:ide`

## Gotchas

- A rebuilt `dist` does not reload already-running IntelliJ-owned adapter processes.
- `docs/` is gitignored; only `STATUS.md` is committed.

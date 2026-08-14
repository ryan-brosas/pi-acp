# Project status

**Project:** pi-acp-jetbrain
**Updated:** 2026-08-15
**State:** Dogfood stability validation in progress at `83e2869c78a81daa04f63dc94c884c562652e88c`.

## Current work

- Run the full automated gate and dogfood suites.
- Exercise the live IntelliJ MCP bridge.
- Record evidence and a release-readiness verdict in `docs/findings/2026-08-15-pi-acp-extension-dogfood-stability.md`.

## Commands

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run dogfood:report`
- `npm run dogfood:ide`

## Gotchas

- A rebuilt `dist` does not reload already-running IntelliJ-owned adapter processes.
- Fresh-host acceptance requires a new IntelliJ chat and matching build identity.

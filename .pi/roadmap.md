# Roadmap

## Project Direction

### Vision

A JetBrains IntelliJ chat that runs pi with full access to the IDE's semantic model — `ide_*` tools for symbols, inspections, refactoring, build/run, and git — wrapped in a disciplined pi-template workflow layer (slash commands, skill packs, Schema-gated mutations).

### Primary Users

IntelliJ users who want pi inside the IDE.

### Primary Success Criterion

**End-to-end reliability.** A new IntelliJ chat gets the IDE tool catalog, pi completes a semantic task through the bridge, and teardown leaves no orphans — plus both gates green: `npm test` and `node scripts/check.mjs`.

### Supporting Product Principles

1. **JetBrains-first:** IntelliJ is the primary and only actively developed host; Zed compatibility is incidental.
2. **Session isolation:** no cross-session mutable state.
3. **Bounded operations:** every transport/discovery/runtime interaction has a deadline.
4. **Safe mutation:** the Schema commit loop remains the progression authority.
5. **Graceful degradation:** unavailable servers are diagnostics, never hard failures.

## Roadmap Overview

| Phase                      | Goal                                                                                                                                                   | Outcome                                                | Status                                                                                                                                                                                                    | Depends on     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1. Template adoption       | Import the pi-template operating layer into this repository and pass the canonical gate                                                                | `node scripts/check.mjs` exit 0 with adapted artifacts | In Progress                                                                                                                                                                                               | Imported files |
| 2. Workspace consolidation | Make this checkout the single workspace: sync to fork `main` (`f6e5ab2`), rebuild `dist`, point `~/.jetbrains/acp.json` at it, retire the stale `dist` | One checkout, one dist, one acp.json                   | Done (2026-08-14: `48f76d2`, acp.json repointed to this checkout's `dist/index.js`, backup `~/.jetbrains/acp.json.bak-20260814-043435`; stale inspo checkout remains on disk but is no longer referenced) | Phase 1        |
| 3. IntelliJ UX polish      | Session history/restore preludes, better tool-call status mapping, allowlist guidance in startup info                                                  | Cleaner in-IDE experience                              | Not Started                                                                                                                                                                                               | Phase 2        |
| 4. Bridge hardening        | SSE reconnect/keepalive, per-server deadline budgets, catalog change notifications                                                                     | Longer-lived chats survive IDE restarts/reindexes      | Not Started                                                                                                                                                                                               | Phase 2        |

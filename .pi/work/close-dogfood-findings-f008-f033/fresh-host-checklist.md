# Fresh-host acceptance evidence (2026-08-14T00:17:22.643Z)

- **[ok]** agent entry references a dist: pi-acp-jetbrain: <repo>/dist/index.js
- **[warn]** PID 7810 runs a different checkout: node <home>/work/inspo/pi-acp/dist/index.js (F-009)
- **[warn]** PID 60824 started 12328s ago, before the dist rebuild 2026-08-14T00:05:09.074Z — stale bundle (F-008)
- **[warn]** PID 172849 started 7792s ago, before the dist rebuild 2026-08-14T00:05:09.074Z — stale bundle (F-008)
- **[warn]** PID 494298 started 1406s ago, before the dist rebuild 2026-08-14T00:05:09.074Z — stale bundle (F-008)
- **[warn]** PID 521437 started 814s ago, before the dist rebuild 2026-08-14T00:05:09.074Z — stale bundle (F-008)
- **[warn]** PID 521472 started 813s ago, before the dist rebuild 2026-08-14T00:05:09.074Z — stale bundle (F-008)
- **[warn]** PID 521657 started 810s ago, before the dist rebuild 2026-08-14T00:05:09.074Z — stale bundle (F-008)
- **[ok]** PID 550122 started 169s ago, after the dist rebuild (F-008)
- **[todo]** start a fresh chat, then confirm: new PID; initialize.agentInfo._meta.piAcp.build.revision matches the on-disk bundle; SSE discovery; tool counts; an IDE tool call; inspection ids; cancel; restore; shutdown (F-033 runbook)
- **[unavailable]** IDE inspection/SSE tools are not exposed to this headless executor; inspection evidence must be captured from the fresh chat (F-030)

## Fresh-chat checklist (F-033)

- [ ] New PID started after the dist rebuild.
- [ ] `initialize.agentInfo._meta.piAcp.build.revision` matches the on-disk bundle.
- [ ] IDE Bridge section shows the expected tool count and no `unavailable` diagnostics.
- [ ] An IDE tool call (e.g. search_symbol) returns a result.
- [ ] Inspection ids recorded from the fresh chat.
- [ ] Cancel, restore, and shutdown verified in the fresh chat.

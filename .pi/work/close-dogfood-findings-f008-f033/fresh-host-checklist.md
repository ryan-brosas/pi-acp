# Fresh-host acceptance evidence (2026-08-14T00:39:16.060Z)

- **[ok]** agent entry references a dist: pi-acp-jetbrain: <repo>/dist/index.js
- **[warn]** PID 7810 runs a different checkout: node <home>/work/inspo/pi-acp/dist/index.js (F-009)
- **[warn]** PID 60824 started 13641s ago, before the dist rebuild 2026-08-14T00:35:42.971Z — stale bundle (F-008)
- **[warn]** PID 172849 started 9106s ago, before the dist rebuild 2026-08-14T00:35:42.971Z — stale bundle (F-008)
- **[warn]** PID 494298 started 2720s ago, before the dist rebuild 2026-08-14T00:35:42.971Z — stale bundle (F-008)
- **[warn]** PID 521437 started 2127s ago, before the dist rebuild 2026-08-14T00:35:42.971Z — stale bundle (F-008)
- **[warn]** PID 521472 started 2127s ago, before the dist rebuild 2026-08-14T00:35:42.971Z — stale bundle (F-008)
- **[warn]** PID 521657 started 2124s ago, before the dist rebuild 2026-08-14T00:35:42.971Z — stale bundle (F-008)
- **[warn]** PID 597780 started 425s ago, before the dist rebuild 2026-08-14T00:35:42.971Z — stale bundle (F-008)
- **[ok]** PID 623678 started 0s ago, after the dist rebuild (F-008)
- **[todo]** start a fresh chat, then confirm: new PID; initialize.agentInfo._meta.piAcp.build.revision matches the on-disk bundle; SSE discovery; tool counts; an IDE tool call; inspection ids; cancel; restore; shutdown (F-033 runbook)
- **[unavailable]** IDE inspection/SSE tools are not exposed to this headless executor; inspection evidence must be captured from the fresh chat (F-030)

## Fresh-chat checklist (F-033)

- [ ] New PID started after the dist rebuild.
- [ ] `initialize.agentInfo._meta.piAcp.build.revision` matches the on-disk bundle.
- [ ] IDE Bridge section shows the expected tool count and no `unavailable` diagnostics.
- [ ] An IDE tool call (e.g. search_symbol) returns a result.
- [ ] Inspection ids recorded from the fresh chat.
- [ ] Cancel, restore, and shutdown verified in the fresh chat.

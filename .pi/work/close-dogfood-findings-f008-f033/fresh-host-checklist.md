# Fresh-host acceptance evidence (2026-08-13T23:46:36.795Z)

- **[ok]** agent entry references a dist: pi-acp-jetbrain: /home/utopia/work/project/pi-acp/dist/index.js
- **[warn]** PID 7810 runs a different checkout: node /home/utopia/work/inspo/pi-acp/dist/index.js (F-009)
- **[warn]** PID 60824 started 10482s ago, before the dist rebuild 2026-08-13T23:42:56.279Z — stale bundle (F-008)
- **[warn]** PID 172849 started 5947s ago, before the dist rebuild 2026-08-13T23:42:56.279Z — stale bundle (F-008)
- **[warn]** PID 305190 runs a different checkout: npm exec pi-acp@0.0.33 (F-009)
- **[warn]** PID 305289 runs a different checkout: node /home/utopia/.cache/JetBrains/IntelliJIdea2026.2/acp-agents/pi-acp/0.0.33/node_modules/.bin/pi-acp (F-009)
- **[warn]** PID 305510 runs a different checkout: npm exec pi-acp@0.0.33 (F-009)
- **[warn]** PID 305589 runs a different checkout: node /home/utopia/.cache/JetBrains/IntelliJIdea2026.2/acp-agents/pi-acp/0.0.33/node_modules/.bin/pi-acp (F-009)
- **[warn]** PID 305639 runs a different checkout: npm exec pi-acp@0.0.33 (F-009)
- **[warn]** PID 305735 runs a different checkout: node /home/utopia/.cache/JetBrains/IntelliJIdea2026.2/acp-agents/pi-acp/0.0.33/node_modules/.bin/pi-acp (F-009)
- **[warn]** PID 306643 started 2838s ago, before the dist rebuild 2026-08-13T23:42:56.279Z — stale bundle (F-008)
- **[warn]** PID 312291 started 2708s ago, before the dist rebuild 2026-08-13T23:42:56.279Z — stale bundle (F-008)
- **[ok]** PID 462294 started 0s ago, after the dist rebuild (F-008)
- **[ok]** PID 462343 started 0s ago, after the dist rebuild (F-008)
- **[todo]** start a fresh chat, then confirm: new PID; initialize.agentInfo._meta.piAcp.build.revision matches the on-disk bundle; SSE discovery; tool counts; an IDE tool call; inspection ids; cancel; restore; shutdown (F-033 runbook)
- **[unavailable]** IDE inspection/SSE tools are not exposed to this headless executor; inspection evidence must be captured from the fresh chat (F-030)

## Fresh-chat checklist (F-033)

- [ ] New PID started after the dist rebuild.
- [ ] `initialize.agentInfo._meta.piAcp.build.revision` matches the on-disk bundle.
- [ ] IDE Bridge section shows the expected tool count and no `unavailable` diagnostics.
- [ ] An IDE tool call (e.g. search_symbol) returns a result.
- [ ] Inspection ids recorded from the fresh chat.
- [ ] Cancel, restore, and shutdown verified in the fresh chat.

# JetBrains ACP Adapter Dogfood Findings and Improvement Handoff

**Date:** 2026-08-14
**Repository:** `pi-acp-jetbrain`
**Branch:** `main`
**Audited revision:** `b7e5ae9e05752bff097b381b8eca6ed639822477` (Phase 2 audit: `4af9792e9f31` → HEAD, see §17)
**Audience:** implementation and release handoff
**Status:** findings resolved or evidence-recorded; host acceptance pending (see §16, §17)

> Direct headless results, historical live-host evidence, and unavailable fresh-host checks are separated below.

## Table of contents

1. Executive summary
2. Scope
3. Environment
4. Method
5. Matrix
6. Strengths
7. Findings
8. Delivery phases
9. Fresh-host runbook
10. Harness design
11. Evidence
12. Checklist
13. Severity
14. Disposition

## 1. Executive summary

Core ACP initialization, session creation, prompt streaming, session statistics, and mode changes worked.
IntelliJ logs prove authenticated SSE and 30 discovered plus 30 registered tools for the running historical process.
The full smoke inventory is not trustworthy as a release gate.
The load probe is stale; compact is a false green; changelog and export do not prove their named features.
Only two of nine smoke files are registered by npm run smoke.
All nine use an empty MCP list.
The current IntelliJ PID predates the latest commit and rebuilt bundle.
The latest candidate therefore still requires a fresh JetBrains chat.

## 2. Scope

### Included

- Built adapter over ACP stdio.
- All nine smoke scripts.
- Parsed results, errors, updates, sizes, and durations.
- Sanitized deployment config.
- IntelliJ process and log correlation.
- SSE and registration evidence.

### Unavailable

- Starting a user-visible fresh chat.
- Calling ide tools from this executor.
- Debug-session xdebug tools.
- Restarting IntelliJ-owned processes.

### Evidence labels

- PASS: semantic expectation met.
- FAIL: intended contract violated.
- FALSE GREEN: shell zero despite failed or unexercised feature.
- WEAK PASS: completion without semantic proof.
- LIVE-HISTORICAL: real evidence predating candidate.
- NOT RUN: capability unavailable.

## 3. Environment

- Revision: `b7e5ae9e05752bff097b381b8eca6ed639822477`.
- Package: `0.0.33`.
- Node: `v26.7.0`.
- Pi: `0.84.1`.
- Adapter: `~/work/project/pi-acp/dist/index.js` (deployed via `~/.jetbrains/acp.json`).
- Dist hash: `7c60bd761b7e0097e72c1e07d11c67942ce7d98433af586b567e977ac4dd1dc8`.
- Dist built: `2026-08-14 05:19:22 +0800`.
- Current project PID: `60824`, started `04:51:54`.
- Historical PID: `7810`.
- Product family: `IntelliJIdea2026.2`.
- Safe SSE port: `64442`.
- Live catalog: 30 discovered and 30 registered.
- Allowlist: 40 names, including 11 conditional xdebug names.

### Freshness conclusion

PID 60824 started before the candidate commit and dist build.
Replacing a JavaScript file does not reload an existing Node process.
That PID is historical evidence only.

## 4. Method

1. Confirm clean state.
2. Pause auto-commit.
3. Read all smoke files.
4. Inspect sanitized config.
5. Run each probe sequentially.
6. Apply a 120-second deadline.
7. Capture isolated logs.
8. Parse result versus error.
9. Count updates and bytes.
10. Inspect slash-command text.
11. Inspect PIDs without killing.
12. Correlate idea.log startup.
13. Verify redaction.
14. Verify SSE and catalog.
15. Compare timestamps.

## 5. Matrix

| Probe       | Seconds | Exit | Result               | Class       |
| ----------- | ------: | ---: | -------------------- | ----------- |
| startupinfo |   5.664 |    0 | required sections    | PASS        |
| acp         |   7.969 |    0 | end_turn             | PASS        |
| acp-load    |  11.155 |    1 | stale null assertion | FAIL        |
| session     |   5.798 |    0 | statistics           | PASS        |
| modes       |   5.799 |    0 | structured updates   | PASS        |
| queue       |  12.782 |    0 | ambiguous semantics  | WEAK PASS   |
| changelog   |   4.789 |    0 | not found            | FALSE GREEN |
| export      |   4.711 |    0 | no artifact          | FALSE GREEN |
| compact     |   4.627 |    0 | internal error       | FALSE GREEN |

### Metrics

- Initialize response: 571 bytes.
- Session/new response: 26,843 bytes.
- Startup prelude: 9,563 characters.
- Logs: approximately 50-59 KB each.
- Two config options.
- Six thinking modes.
- Compact detail: session too small.

## 6. Strengths

- ACP v1 initialization succeeds.
- Session creation and prompt streaming work.
- Startup metadata includes Context, Skills, and Extensions.
- Mode/config updates work.
- Descriptor secrets are redacted.
- Authenticated SSE was selected.
- All discovered live tools registered.
- Long-lived PIDs are IntelliJ-owned.

## 7. Findings

### F-001: Modernize stale session/load smoke

- **Priority:** P1
- **Status:** Open.
- **Evidence:** load probe expects null but current loadSession returns configuration and metadata; dogfood exited 1.
- **Recommendation:** assert current response, replay, metadata, and clean exit.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-002: Fail compact smoke on ACP errors

- **Priority:** P1
- **Status:** Open.
- **Evidence:** compact returned Internal error because the session was too small while shell exited 0.
- **Recommendation:** create deterministic result and expected-error cases.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-003: Remove response-id-only success

- **Priority:** P1
- **Status:** Open.
- **Evidence:** most probes terminate when an id appears without checking result versus error.
- **Recommendation:** create shared expectResult and expectError primitives.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-004: Add internal smoke deadlines

- **Priority:** P1
- **Status:** Open.
- **Evidence:** eight probes have no failure deadline without an external wrapper.
- **Recommendation:** bound request, case, and shutdown paths.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-005: Register maintained smoke matrix

- **Priority:** P1
- **Status:** Open.
- **Evidence:** npm run smoke reaches two of nine files.
- **Recommendation:** classify and wire core and extended lanes.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-006: Dogfood non-empty MCP descriptors

- **Priority:** P1
- **Status:** Open.
- **Evidence:** all smokes send mcpServers empty.
- **Recommendation:** add authenticated fake SSE and fresh-host lanes.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-007: Expose loaded build identity

- **Priority:** P1
- **Status:** Open.
- **Evidence:** PID 60824 predates commit b7e5ae9 and rebuilt dist.
- **Recommendation:** report revision version timestamp and bundle id.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-008: Require fresh process after rebuild

- **Priority:** P1
- **Status:** Open.
- **Evidence:** IntelliJ reuses sessions and Node does not reload replaced files.
- **Recommendation:** detect stale processes and document fresh chat.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-009: Retire stale inspo runtime

- **Priority:** P2
- **Status:** Open.
- **Evidence:** PID 7810 still runs the historical checkout.
- **Recommendation:** close historical chat manually and verify launch paths.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-010: Reduce session/new payload

- **Priority:** P2
- **Status:** Open.
- **Evidence:** response measured 26843 bytes and startupInfo 9563 characters.
- **Recommendation:** profile sections and define a byte budget.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-011: Remove routine absolute paths

- **Priority:** P2
- **Status:** Open.
- **Evidence:** startup prose lists many home-directory paths.
- **Recommendation:** prefer relative paths package ids and counts.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-012: Make changelog smoke semantic

- **Priority:** P2
- **Status:** Open.
- **Evidence:** it returned Changelog not found and exited zero.
- **Recommendation:** use configured Pi path and assert useful output.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-013: Make export smoke create artifact

- **Priority:** P2
- **Status:** Open.
- **Evidence:** it returned Nothing to export yet and made no product HTML.
- **Recommendation:** seed turn validate HTML and clean temp cwd.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-014: Clarify queue semantics

- **Priority:** P2
- **Status:** Open.
- **Evidence:** probe produced model prose rather than structured state proof.
- **Recommendation:** assert steering or follow-up state deterministically.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-015: Build once per matrix

- **Priority:** P2
- **Status:** Open.
- **Evidence:** seven probes rebuild and matrix took about 63 seconds.
- **Recommendation:** run all cases against one recorded dist hash.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-016: Summarize protocol logs

- **Priority:** P2
- **Status:** Open.
- **Evidence:** passing logs were 50 to 59 KB with huge single lines.
- **Recommendation:** print concise summaries and preserve redacted failures.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-017: Await graceful shutdown

- **Priority:** P2
- **Status:** Open.
- **Evidence:** scripts signal but do not await exit or child cleanup.
- **Recommendation:** centralize close and verify owned children.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-018: Add cancellation dogfood

- **Priority:** P2
- **Status:** Open.
- **Evidence:** no smoke sends session/cancel.
- **Recommendation:** cancel deterministic work and reject late updates.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-019: Add session lifecycle matrix

- **Priority:** P2
- **Status:** Open.
- **Evidence:** list and delete lack built-artifact probes.
- **Recommendation:** isolate new list load replay delete and idempotence.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-020: Add protocol negative cases

- **Priority:** P2
- **Status:** Open.
- **Evidence:** current probes send only valid requests.
- **Recommendation:** table-test invalid version cwd session mode and prompt.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-021: Invoke IDE tools end to end

- **Priority:** P2
- **Status:** Open.
- **Evidence:** logs prove SSE and 30 of 30 registration but no call here.
- **Recommendation:** fresh-chat search symbol inspection and safe build calls.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-022: Explain conditional debugger tools

- **Priority:** P3
- **Status:** Open.
- **Evidence:** allowlist has 40 names with 11 xdebug while normal catalog has 30.
- **Recommendation:** report conditional availability clearly.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-023: Clarify tools/list_changed

- **Priority:** P3
- **Status:** Open.
- **Evidence:** JetBrains emits changes while catalog is immutable.
- **Recommendation:** dedupe restart diagnostic and study re-registration.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-024: Centralize Pi command resolution

- **Priority:** P2
- **Status:** Open.
- **Evidence:** Pi spawn works but changelog cannot locate installation.
- **Recommendation:** use PI_ACP_PI_COMMAND in all helpers.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-025: Generalize package metadata

- **Priority:** P3
- **Status:** Open.
- **Evidence:** package description still says IntelliJ only.
- **Recommendation:** align metadata while retaining primary-host caveat.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-026: Validate smoke inventory

- **Priority:** P3
- **Status:** Open.
- **Evidence:** unregistered smoke files cause no canonical failure.
- **Recommendation:** require classification owner timeout and reachability.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-027: Isolate dogfood session storage

- **Priority:** P2
- **Status:** Open.
- **Evidence:** matrix wrote JSONL into the real user store.
- **Recommendation:** use temporary PI_CODING_AGENT_DIR.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-028: Test bridge-log redaction

- **Priority:** P2
- **Status:** Open.
- **Evidence:** current descriptor is safe but new fields may drift.
- **Recommendation:** deny by default and test nested values.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-029: Document benign IDE log noise

- **Priority:** P3
- **Status:** Open.
- **Evidence:** Agent not installed appears for a healthy local command agent.
- **Recommendation:** document benign and actionable patterns.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-030: Persist IDE inspection evidence

- **Priority:** P3
- **Status:** Open.
- **Evidence:** this executor exposed no ide tools and prior evidence was conversational.
- **Recommendation:** record product tool warning ids and unavailable reason.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-031: Test supported Node versions

- **Priority:** P3
- **Status:** Open.
- **Evidence:** package supports Node 20 but dogfood ran Node 26 only.
- **Recommendation:** test Node 20 and current LTS.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-032: Emit machine-readable dogfood report

- **Priority:** P3
- **Status:** Open.
- **Evidence:** ad hoc parsing was required for metrics.
- **Recommendation:** emit versioned JSON and Markdown reports.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

### F-033: Require fresh-chat release acceptance

- **Priority:** P2
- **Status:** Open.
- **Evidence:** live process predates candidate.
- **Recommendation:** require new PID build id SSE call inspection cancel restore and shutdown.
- **Impact:** Release confidence, operator clarity, or primary-host coverage is weaker than the passing gate suggests.
- **Root concern:** Executable evidence must prove semantics rather than only process completion.
- **Acceptance 1:** A deterministic positive assertion exists.
- **Acceptance 2:** An unexpected ACP error returns nonzero.
- **Acceptance 3:** Requests and processes have deadlines.
- **Acceptance 4:** Evidence is redacted.
- **Test 1:** Exercise built `dist/index.js`.
- **Test 2:** Trigger the failure and prove detection.
- **Test 3:** Confirm no owned process remains.
- **Implementation:** Use the shared harness.
- **Review:** Inspect shell status and ACP envelopes.
- **IDE validation:** Use a fresh chat for bridge-crossing work.
- **Documentation:** Update operator guidance with behavior changes.
- **Owner:** Adapter maintainer plus area reviewer.
- **Effort:** Small to medium unless host automation is required.
- **Dependencies:** ACP SDK, Pi behavior, and JetBrains lifecycle as applicable.
- **Completion evidence:** Commit, commands, outputs, and loaded build identity.
- **Disposition:** Create an issue or scoped work item.

## 8. Delivery phases

### Phase A: smoke trust

1. Fix F-001 through F-005.
2. Build shared bounded harness.
3. Correct semantic oracles.
4. Build once.
5. Emit reports.

### Phase B: host acceptance

1. Add build identity.
2. Start fresh chat.
3. Verify PID.
4. Verify SSE.
5. Invoke IDE tools.
6. Run inspections.
7. Resolve P0/P1.

### Phase C: lifecycle

1. Add cancellation.
2. Add list/load/delete.
3. Add invalid requests.
4. Assert shutdown.
5. Run Node matrix.

### Phase D: UX

1. Reduce payload.
2. Remove absolute paths.
3. Explain debugger tools.
4. Align metadata.
5. Validate inventory.

## 9. Fresh-host runbook

### Preconditions

- [ ] Candidate commit recorded.
- [ ] Build follows commit.
- [ ] Dist hash recorded.
- [ ] Config points to candidate.
- [ ] Secrets remain private.

### New process

1. Start a new chat.
2. Find new PID.
3. Confirm start after build.
4. Confirm project path.
5. Confirm build identity.
6. Confirm sanitized descriptor.
7. Confirm token SSE.
8. Confirm tool counts.
9. Confirm JetBrains IDE wording.
10. Explain partial status.

### IDE calls

1. Search `AcpMcpBridge`.
2. Get symbol information.
3. Analyze calls.
4. Get file problems.
5. Record inspection ids.
6. Compare Git status.
7. Run safe build/inspection.
8. Avoid accidental mutation.

### Lifecycle

1. Prompt.
2. Verify stream.
3. Change mode.
4. Start slow work.
5. Cancel.
6. Reject late chunks.
7. Restore session.
8. Verify replay.
9. Close chat.
10. Verify cleanup.

## 10. Harness design

- Spawn one immutable build.
- Correlate ids.
- Distinguish result/error.
- Collect typed updates.
- Apply deadlines.
- Redact stderr.
- Await exit.
- Verify children.
- Emit JSON and Markdown.
- Preserve failure artifacts.

### Suggested scripts

- `smoke:core`.
- `smoke:sessions`.
- `smoke:commands`.
- `smoke:mcp-fixture`.
- `smoke:negative`.
- `smoke:extended`.
- `dogfood:report`.
- `dogfood:ide`.

## 11. Evidence

### Repository

- `package.json`.
- `scripts/smoke-acp.mjs`.
- `scripts/smoke-startupinfo.mjs`.
- `scripts/smoke-acp-load.mjs`.
- `scripts/smoke-session.mjs`.
- `scripts/smoke-modes.mjs`.
- `scripts/smoke-queue.mjs`.
- `scripts/smoke-changelog.mjs`.
- `scripts/smoke-export.mjs`.
- `scripts/smoke-compact.mjs`.
- `src/acp/agent.ts`.
- `src/acp/session.ts`.
- `src/acp/mcp-bridge.ts`.

### Runtime

- `/tmp/smoke-acp.dogfood.log`.
- `/tmp/smoke-acp-load.dogfood.log`.
- `/tmp/smoke-session.dogfood.log`.
- `/tmp/smoke-modes.dogfood.log`.
- `/tmp/smoke-queue.dogfood.log`.
- `/tmp/smoke-changelog.dogfood.log`.
- `/tmp/smoke-export.dogfood.log`.
- `/tmp/smoke-compact.dogfood.log`.
- IntelliJ `idea.log`.

## 12. Checklist

### Implementation

- [ ] Create P1 issues.
- [ ] Test first.
- [ ] Preserve unrelated work.
- [ ] Bound all operations.
- [ ] Redact evidence.
- [ ] Await cleanup.
- [ ] Assert semantics.
- [ ] Run IDE inspections.
- [ ] Obtain no-P0/P1 review.

### Completion

- [ ] Canonical passes.
- [ ] Tests pass.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Build passes.
- [ ] Deterministic smokes pass.
- [ ] Negative probes detect faults.
- [ ] Fresh host loads candidate.
- [ ] IDE call succeeds.
- [ ] Watcher active.
- [ ] Atomic commit.
- [ ] No push without approval.

## 13. Severity

- P0: exposure, destructive loss, unauthorized execution, or widespread failure.
- P1: primary workflow or evidence gate materially broken.
- P2: material reliability, coverage, privacy, performance, or operator gap.
- P3: consistency, maintenance, documentation, or future-proofing.
- False green: zero exit despite failed or unexercised behavior.

## 14. Disposition

### Proven

- Core built ACP handshake works.
- Prompt reaches end_turn.
- Startup metadata exists.
- Mode updates work.
- Historical SSE and 30/30 registration work.

### Not proven for candidate

- Fresh host loaded current dist.
- Live latest-source inspections are clean.
- Latest IDE invocation succeeds.
- Real-host cancellation works.
- Complete smoke matrix is safe.

### Next action

Implement F-001 through F-005, add build identity, rebuild once, and run the fresh-host checklist.
Do not treat PID 60824 as candidate evidence.
Do not call compact, changelog, or export successful until their assertions are corrected.

## 15. Implementation log (2026-08-14)

Implemented in commit `6fcec7a` (`feat(smoke): shared bounded harness, honest probes, loaded build identity`); verified at that revision.

### Resolved findings

- **F-001 — Implemented.** `scripts/smoke-acp-load.mjs` asserts the current `LoadSessionResponse` object contract (`configOptions`, `models`, `modes`, `_meta`), replay updates > 0, and null startup info on a headless load; it previously asserted the legacy null result and failed.
- **F-002 — Implemented.** `scripts/smoke-compact.mjs` is an expected-negative oracle: it requires the ACP error -32603 with details containing `Nothing to compact (session too small)` and fails on any successful response.
- **F-003 — Implemented.** All nine probes distinguish result and error envelopes via `scripts/lib/acp-smoke.mjs` (`expectResult` / `expectError`) and fail on unexpected JSON-RPC errors.
- **F-004 — Implemented.** The shared harness bounds every request (default 30s, prompts 60s), suite deadline (120s), update waits, and shutdown (SIGTERM with 5s grace, SIGKILL escalation); each probe asserts clean adapter exit.
- **F-005 — Implemented (package-script reachability).** `npm run smoke` builds once and runs startupinfo + acp; `npm run smoke:full` runs all nine probes against one build; `smoke:core` aliases `smoke`. CI documents why the full matrix stays local (spawns the `pi` binary and makes real model calls; GitHub runners do not provision either).
- **F-007 — Implemented.** `src/build-info.ts` exposes `revision`, `buildTime`, `packageVersion`, `isRelease` (tsup-injected `__PI_ACP_BUILD_REVISION__` / `__PI_ACP_BUILD_TIME__` with dev fallbacks); `initialize` reports `agentInfo._meta.piAcp.build` and the startup prelude carries a build line; `smoke-startupinfo` asserts the identity. Covered by `test/unit/build-info.test.ts`.
- **F-016 — Implemented.** Probes no longer rebuild per script; the package scripts build once and the harness prints the dist sha256.
- **F-017 — Implemented.** The harness `close()` awaits adapter exit; `test/unit/entrypoint-shutdown.test.ts` hardened (10s windows, kill-on-failure) so a hung child can never stall the suite.
- **F-013 — Partially.** `smoke-export` now detects newly created `pi-session-*.html` artifacts in cwd, verifies structural HTML (`<!DOCTYPE html>`, `Session Export` title, size), and cleans up; artifact path-parsing remains pi-side.
- **F-012/F-014 — Status quo documented.** `smoke-changelog` and `smoke-queue` assert round-trip completion and report semantic content; pi-side semantics (installation lookup, queue control) remain open follow-ups.

### Verification at 6fcec7a

- `node scripts/check.mjs` exit 0 (`repository check: ok`).
- `npm test` 144 pass / 0 fail (includes `build-info` and hardened `entrypoint-shutdown`).
- `npm run lint`, `npm run typecheck`, `npm run build` exit 0.
- `npm run smoke:full` — all nine probes OK: startupinfo (build identity asserted), acp (3 chunks, end_turn), acp-load (2 replay updates), session (stats text), modes (mode/config updates), queue (2 turns), changelog (20 KB text), export (artifact verified and cleaned), compact (expected -32603).
- Prettier clean on all changed files; dist rebuilt with build identity.

### Still required

- Start a fresh IntelliJ chat so a new PID loads the rebuilt `dist` (existing PID 60824 predates commit `6fcec7a`).
- Confirm the startup prelude shows the new build line and `initialize.agentInfo._meta.piAcp.build.revision` matches the on-disk bundle.
- Open follow-ups for the remaining P2/P3 findings (see section 7), notably F-006 (non-empty MCP descriptor lane), F-018 (cancellation), F-019 (list/load/delete lifecycle), and F-027 (isolated session store).

## 16. Closure status (F-008 through F-033)

Resolution recorded 2026-08-14 after the F-008–F-033 campaign (work record `.pi/work/close-dogfood-findings-f008-f033/`).

| F     | Priority | Status                                                    | Evidence                                                                                                                               |
| ----- | -------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| F-008 | P1       | Implemented (runner); host confirmation pending           | `scripts/dogfood-ide.mjs` flags PIDs started before the dist rebuild; README documents fresh-chat-after-rebuild                        |
| F-009 | P2       | Evidence captured; user action pending                    | dogfood-ide run: PID 7810 still runs the inspo checkout; PIDs 305xxx run the published npm 0.0.33 package. Close stale chats manually. |
| F-010 | P2       | Implemented                                               | smoke-startupinfo 32 KB prelude budget + per-section profile (6.1 KB measured); smoke-acp 64 KB session/new budget (26.7 KB measured)  |
| F-011 | P2       | Implemented                                               | `buildStartupInfo` uses cwd-relative / `~` labels; prelude shrank 9,596 → 6,175 chars                                                  |
| F-012 | P2       | Implemented                                               | changelog lookup uses `getPiCommand(PI_ACP_PI_COMMAND)` (F-024); probe reports round-trip honestly                                     |
| F-013 | P2       | Implemented                                               | smoke-export detects `pi-session-*.html`, verifies structure, cleans up                                                                |
| F-014 | P2       | Documented                                                | queue control is pi-side; smoke-queue asserts two end_turn turns                                                                       |
| F-015 | P2       | Implemented                                               | probes run against one recorded dist hash (commit `6fcec7a`)                                                                           |
| F-016 | P2       | Implemented                                               | `dogfood-report.mjs` prints concise per-probe summaries and preserves redacted failure tails                                           |
| F-017 | P2       | Implemented                                               | harness `close()`/`assertExited`; entrypoint-shutdown suite hardening                                                                  |
| F-018 | P2       | Implemented                                               | smoke-cancel: cancelled stopReason, no late chunks, follow-up turn; adapter cancel is non-blocking                                     |
| F-019 | P2       | Implemented                                               | smoke-lifecycle: create/list/seed/close/load-replay/delete/idempotent-delete on the built dist                                         |
| F-020 | P2       | Implemented                                               | smoke-negative: unknown prompt/load, relative cwd, cancel no-op, idempotent delete, version clamp, bogus cursor                        |
| F-021 | P2       | Implemented for the fixture bridge; real-IDE call pending | smoke-mcp-fixture invoked `ide_fixture_echo` through the full adapter+pi IPC path; fresh-chat IDE call remains                         |
| F-022 | P3       | Implemented                                               | README documents conditional `xdebug_*` registration                                                                                   |
| F-023 | P3       | Implemented                                               | shared `LIST_CHANGED_DIAGNOSTIC` dedupe across both paths + unit test                                                                  |
| F-024 | P2       | Implemented                                               | changelog lookup resolves the configured pi command                                                                                    |
| F-025 | P3       | Implemented                                               | package description generalized to JetBrains IDEs primary host                                                                         |
| F-026 | P3       | Implemented                                               | `validate-smoke-inventory.mjs` in canonical; unregistered probe fails the gate (proven)                                                |
| F-027 | P2       | Implemented                                               | `PI_ACP_SESSION_MAP` override + symlink-overlay agent dir; all 13 probes isolated; cleanup asserted; real store untouched              |
| F-028 | P2       | Implemented                                               | `sanitizeBridgeDescriptors` deny-by-default redaction + nested-value tests; fixture probe asserts no secret in stderr                  |
| F-029 | P3       | Implemented                                               | README "IDE log noise" section (benign and actionable patterns)                                                                        |
| F-030 | P3       | Implemented                                               | `dogfood-ide.mjs` records unavailable reasons and the fresh-chat checklist                                                             |
| F-031 | P3       | Implemented                                               | check.yml matrix on Node 20 and 24                                                                                                     |
| F-032 | P3       | Implemented                                               | `dogfood-report.mjs` emits versioned JSON (schema `pi-acp.dogfood-report.v1`) + Markdown, redacted                                     |
| F-033 | P2       | Runner + runbook implemented; acceptance pending          | `dogfood-ide.mjs` + §9 runbook; requires a fresh chat: new PID, build revision, SSE, tool call, inspections, cancel, restore, shutdown |

### Still required

- Fresh IntelliJ chat for F-033 acceptance and the real-IDE halves of F-008/F-009/F-021: new PID after the dist rebuild, `_meta.piAcp.build.revision` match, an IDE tool call, inspection ids, cancel/restore/shutdown.
- Close stale chats (PID 7810 inspo checkout; PIDs 305xxx published-package launches) once the local entry is confirmed.

## 17. Phase 2 UX audit (2026-08-14)

Second dogfood pass over revision `4af9792e9f31` with live IntelliJ MCP tools, fresh dogfood journeys, and an independent gpt-5.6-sol product/UX review. Verdict: no P0; 6 P1, 10 P2, 3 P3.

### Evidence gathered

- Live IntelliJ tools (routed through the then-running inspo bridge): git status clean, IDE build success, 94-file inspection sweep (24 src + 27 scripts + 43 tests). The tools' `source` path exposed the provenance gap itself — the chat was served from the inspo checkout, not this one.
- `dogfood:report`: 13/13 probes OK (dist `af385bed40d1`, build `4af9792e9f31`).
- `dogfood:ide`: `~/.jetbrains/acp.json` now points at this checkout; PID 7810 still runs the inspo checkout; several stale-bundle PIDs; one fresh PID after the rebuild.

### P1 fixes landed in this phase

| # | Finding | Fix |
| --- | --- | --- |
| P1-2 | `cancel()` awaited the slow pi abort before bridge cancellation | `bridge.cancelAll()` runs first; ordering test added |
| P1-3 | pi stderr was discarded; a failed turn looked like a normal completion | bounded stderr tail retained (`PiRpcProcess.stderrTailLines`) and surfaced via `_meta.piAcp.error` in the prompt result; unit tests |
| P1-4 | onboarding examples omitted `idea_mcp_allowed_tools` (AllowAll) | README primary example ships a deny-by-default read/build profile |
| P1-5 | probe oracles could be satisfied by the startup chunk; queue probe sent `/queue` | `smoke-cancel`/`smoke-acp` baseline chunk counts after `session/new`; `smoke-queue` now fires two concurrent prompts through the adapter queue |
| P1-6 | dogfood exited 0 without a fresh build or host acceptance | `dogfood-report` builds first and fails on build failure; `dogfood-ide` exits 1 on warn findings |

### P1-1 open (deliberately deferred)

An accepted prompt can stay unresolved forever if pi exits mid-generation or the session is disposed: `pendingTurn` settles only on `agent_settled`, and `dispose()` rejects queued turns but not the running turn. Recommended fix: propagate process exit into sessions, settle `pendingTurn` on dispose, add a turn watchdog. Deferred because it is a turn-lifecycle redesign needing dedicated cancel/queue interplay tests.

### P2/P3 addressed

- P2-13 consistency: version/update checks honor `PI_ACP_PI_COMMAND`; prompts/extensions inventory uses `getAgentDir()` (PI_CODING_AGENT_DIR-aware); README Node claim aligned to engines (`>=20`, CI 20/24).
- P2-16 export file URI: raw interpolation replaced with `pathToFileURL()`.
- P2-14 pinned-npx note added; P3-17 env JSON example fixed; P3-19 thinking-stream wording aligned (`agent_thought_chunk`); P3-18 this doc refreshed.

### Remaining recommendations (not yet implemented)

- P2-7 session-map atomicity (write temp + rename); P2-8 deletion should report unlink failures; P2-9 paginated/size-bounded session restore; P2-10 parallel MCP discovery; P2-11 surface `tools/list_changed` after startup; P2-12 bounded inventory traversal; P2-15 revision identity for dirty source.
- P1-1 turn-lifecycle watchdog (see above).
- Real-IDE allowlist verification against a fresh chat (the profile's tool names come from the observed catalog).

### Reviewer's three highest-value next changes

1. Deterministic turn lifecycle (P1-1).
2. Secure copy-paste onboarding — implemented in README; verify tool names on a fresh chat.
3. Dogfood as a real gate — implemented: build-first report + nonzero on warn.

---

End of handoff.

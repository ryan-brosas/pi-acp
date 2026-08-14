# Adapter-Enforced IDE Inspection — Deep Research

> **Question under investigation:** Is enforcing IDE inspections inside the ACP adapter "inventing shit" (a novel, over-engineered mechanism), or does it align with an established pattern we are simply not using yet?
>
> **Verdict up front:** It is **not** a protocol invention and **not** a new linter. It is a **policy hook at the turn boundary** that reuses (a) the IDE's own inspection engine and (b) the existing MCP tool surface. The genuinely open question is not *whether* the mechanism is standard, but *where the policy should live* — adapter, model, host, or CI — and the evidence shows the adapter is the only layer that can make it deterministic today.

---

## 1. Executive summary

1. ACP (Agent Client Protocol) has **no first-class "diagnostics" or "inspection" channel**. An agent can emit `agent_message_chunk` (prose), `tool_call`/`tool_call_update` (status + content + file locations), and a few mode/config updates. There is no protocol slot for "here are lint results for these files."
2. IntelliJ already ships the inspection **engine** (its own static analysis) and exposes it as MCP tools (`get_file_problems`, `lint_files`, `search_symbol`, …) through an in-process SSE endpoint guarded by a per-chat token.
3. What we lack is a **guaranteed trigger**. A model-prompted skill is advisory and was demonstrably skipped during this project's own implementation. The adapter is the only component that (a) owns the authenticated IDE connection, (b) sees the ACP turn boundary, and (c) can therefore run the inspection *deterministically* — exactly like a pre-commit hook or CI step, but inside the agent loop.
4. Therefore the proposal is best understood as **"a deterministic post-turn gate implemented at the only place that has the necessary authority"**, not as a new protocol element, a new linter, or a fork of any runtime.

---

## 2. Scope and method

This research answers one question precisely: **"Should the pi-acp-jetbrain adapter enforce IDE inspections on every ACP turn, and is that a legitimate engineering pattern?"**

Evidence inspected (all local, cited below):

| Source | What it told us |
| --- | --- |
| `@agentclientprotocol/sdk` schema (`dist/schema/types.gen.d.ts`, `dist/acp.d.ts`) | The exact ACP surface: session methods, `SessionUpdate` union, capabilities, `McpServer` transports |
| `@agentclientprotocol/sdk/README.md` | Protocol docs pointer, production implementation (Gemini CLI), examples |
| IntelliJ `platform-acp-plugin` + `ml-llm/…acp*.jar` + `embeddedMcp.jar` | The host side: ACP client, private MCP server, stdio descriptor + SSE endpoint |
| `src/acp/mcp-bridge.ts`, `mcp-sse.ts`, `mcp-stdio.ts`, `mcp-ipc.ts`, `agent.ts`, `session.ts` (this repo) | The adapter's bridge: SSE auth, single-client IPC, turn lifecycle |
| `docs/findings/2026-08-14-jetbrains-acp-dogfood-findings.md` | F-001…F-033: the prior dogfood analysis, including F-021 ("invoke IDE tools end to end") and F-030 ("persist IDE inspection evidence") left open |
| `pi-fabric` package (`~/.pi/agent/npm/node_modules/pi-fabric`) | The executor layer: `skill-prompt`, `skill-references`, `runtime-paths` — confirms the executor is host-agnostic and owns prompt injection, not ACP lifecycle |
| `pi-coding-agent` package (`core/skills.js`) | Skill discovery/visibility (`.pi/skills/`, packs.json, manifest.json) |
| Live probes | `curl :64442/sse` → 401 (auth-gated); `get_file_problems`/`lint_files` → real results; `/proc/<pid>/environ` → no `IJ_MCP_SERVER_*` in adapter env |

---

## 3. What ACP actually defines (the protocol surface)

### 3.1 Core lifecycle

From the SDK schema, an Agent **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`. Everything else is optional and negotiated via capabilities.

- `initialize` — negotiates protocol version and agent capabilities.
- `session/new` — creates a session with `cwd` and (in the MCP draft) `mcpServers`.
- `session/prompt` — streams the model turn; returns a `PromptResponse` with `stopReason` (`end_turn` / `cancelled` / etc.).
- `session/cancel` — asks the agent to stop.
- `session/update` — a **notification** the agent pushes to the client during a turn.

### 3.2 The `SessionUpdate` union — the only agent→client channels

The schema gives an agent exactly these update kinds:

```text
agent_message_chunk   — prose/structured assistant output (ContentChunk)
agent_thought_chunk   — reasoning output
agent_state_changed   — (capability-gated)
tool_call             — the agent is invoking a *client-side* tool
agent_thought_chunk   — reasoning output
tool_call_update      — status + content + locations for a tool call
current_mode_update   — mode changes
config_option_update  — config changes
```

Critical observation: **there is no `diagnostics` / `problems` / `inspection` update kind.** The only ways an agent can report "these files have problems" are:

1. `agent_message_chunk` — prose, i.e. the model *talking* about it (advisory, unstructured).
2. `tool_call` + `tool_call_update` — the agent invoking a *client* tool, with `status` (`pending|in_progress|completed|failed`) and optional `locations` (file/line).

This matters because it means **the protocol itself has no opinion about code-quality gates**. It neither forbids nor enables them; a gate has to be expressed as ordinary turn behavior (tool calls + messages).

### 3.3 Capabilities

Relevant capability families in the schema:

| Capability | Meaning | Notes |
| --- | --- | --- |
| `fs.readTextFile` / `fs.writeTextFile` | The **client** (editor) exposes filesystem reads/writes to the agent | This repo deliberately does **not** use client FS in MVP; pi reads/writes locally |
| `mcp.http` / `mcp.sse` / `mcp.acp` | Which MCP transports the agent accepts | IntelliJ uses stdio descriptor + SSE endpoint |
| `session.*` | Extra session methods | `session/load`, etc. |
| `auth.*` | Auth flows | not used here |
| `provider.*` / `nes.*` | provider config / next-edit-suggestions | out of scope |

### 3.4 The MCP draft transport (`McpServer` union)

The schema defines four server shapes (several marked "not part of the spec yet, may be removed or changed"):

```text
McpServerHttp  { baseUrl, ... }
McpServerSse   { baseUrl, ... }
McpServerAcp   { id (McpServerAcpId), ... }
McpServerStdio { command, args, env: Array<{ name, value }> }
```

IntelliJ supplies a **stdio descriptor** (`command: idea.sh`, `args: [stdioMcpServer]`, `env` carrying `IJ_MCP_SERVER_PORT`, `IJ_MCP_AUTH_TOKEN`, `IJ_MCP_SERVER_PROJECT_PATH`) but the `idea.sh` launcher exits 0 without speaking MCP, so the adapter bridges to the in-process **SSE** endpoint instead. This is all *existing* transport machinery — nothing new is being invented for enforcement.

---

## 4. The IntelliJ host implementation (what the IDE already does)

### 4.1 Components on disk

```text
~/.local/share/JetBrains/idea-IU-262.9437.185/plugins/platform-acp-plugin/
    lib/platform-acp-plugin.jar
    lib/modules/intellij.platform.acp.jar          ← ACP client (the host side)
~/.local/share/JetBrains/IntelliJIdea2026.2/ml-llm/lib/modules/
    intellij.ml.llm.agents.acp.jar                 ← ACP agent integration
    intellij.ml.llm.agents.acp.embeddedMcp.jar     ← the private in-process MCP server
    intellij.ml.llm.agents.acp.json.jar
```

### 4.2 What this means

The IDE **already runs** its inspections (IntelliJ's own static analysis, the same engine behind the red/green editor gutters and the "Problems" tool window). The `embeddedMcp` server exposes that engine as MCP tools. The adapter's live catalog (from the earlier `tools.list`) includes:

```text
get_file_problems, lint_files, search_symbol, search_text, search_regex,
analyze_calls, get_symbol_info, build_project, apply_patch, create_new_file,
open_file_in_editor, reformat_file, rename_refactoring, execute_run_configuration,
run_inspection_kts, validate_inspection_kts, generate_inspection_kts_api, …
```

So the enforcement idea does **not** build a linter. It *drives the IDE's existing linter* through the existing MCP surface. The adapter is not competing with IntelliJ's analysis; it is making sure that analysis actually runs on the agent's output at a deterministic moment.

### 4.3 The hard constraints discovered (why the adapter is the only enforcement point)

1. **Per-chat auth.** `GET http://127.0.0.1:64442/sse` returns `401 — "MCP server is running in restricted mode. Please, provide valid authorization token"`. The token (`IJ_MCP_AUTH_TOKEN`) is generated per chat, held only in the IDE + adapter memory, and redacted in every log (`[redacted 36 chars]`). A separate headless process **cannot** reach the IDE endpoint.
2. **Single-client IPC.** `McpIpcServer.#accept` destroys any second connection. A sidecar process cannot piggyback on the live session's bridge.
3. **Turn boundary visibility.** Only the adapter sees `session/prompt` completion. The executor (`pi-fabric`) does not know what an ACP turn is.

Together these three facts *force* the conclusion: the only component that can deterministically run IDE inspections on the agent's work is the adapter itself.

---

## 5. Prior art — how others solve "make the code get checked"

### 5.1 Inside the agent loop (per-turn, in-editor)

| System | Mechanism | Deterministic? |
| --- | --- | --- |
| **Gemini CLI** (the SDK's cited production ACP agent) | Model invokes tools; editors surface results | Model-driven (advisory) |
| **opencode** (this repo models after it) | Model + skills + tool policies | Mostly model-driven |
| **Claude Code / Cursor** | IDE/LSP diagnostics stream live from the editor; the model reads them | Host-driven (but only *reported*, not *enforced as a gate*) |
| **This proposal** | Adapter runs the IDE's inspection tools at turn end and records/reports | Deterministic |

### 5.2 Outside the agent loop (CI/pre-commit)

| Mechanism | What it enforces | Relationship to the agent |
| --- | --- | --- |
| `eslint` / `tsc --noEmit` / `prettier --check` in CI | deterministic gates on push/PR | after-the-fact; separate loop |
| git pre-commit hook | lint/staged files before commit | at commit boundary, not per-turn |
| IDE "inspect on save" / code style on commit | IDE-native analysis | already exists in IntelliJ; not wired to the agent's output stream |

### 5.3 The pattern this actually is

The proposal is structurally identical to a **git pre-commit hook or a CI lint job**, but relocated to the ACP turn boundary. That is a *known, boring* category — "run a deterministic check after a unit of work, and record/report the result." The novelty (if any) is only *which layer owns the hook*, not the idea of the hook.

---

## 6. The "inventing shit?" analysis — the core

### 6.1 What we are NOT inventing

1. **Not a new protocol.** We are not adding a message type to ACP. Results flow over the existing `session/update` (`agent_message_chunk`) and the `PromptResponse._meta`, plus a persisted file.
2. **Not a new linter.** We reuse `get_file_problems` / `lint_files` from the IDE's own engine.
3. **Not a new transport.** We reuse the bridge's existing `SseMcpClient`/`StdioMcpClient` connection.
4. **Not a runtime fork.** `pi-fabric` is untouched; the policy lives in this repo's `src/acp/`.
5. **Not a model dependency.** The model can be wrong, forgetful, or skipped; the gate still runs.

### 6.2 What IS new (and needs justification)

1. **The adapter becomes a gatekeeper.** This is a *ownership* decision: the adapter takes on a CI-like responsibility. That is the real change, and it should be discussed on those terms — not as "invention," but as "where does the quality gate live?"
2. **Per-turn cost.** Every `end_turn` triggers a lint. If unbounded, this adds latency. Mitigation: changed-file filtering, file cap, timeout, and a flag.

### 6.3 Honest answer to the question

**No, this is not inventing shit in the pejorative sense.** It is the *smallest deterministic mechanism* that achieves what the project's own findings (F-021, F-030, F-033) already said was missing. The alternative — a model skill — was tried by implication (AGENTS.md already *says* "run IDE inspections") and failed to actually happen. What we are adding is the missing *guarantee*, at the only layer that has the authority to provide it.

---

## 7. Design space — where could the enforcement live? (options compared)

### Option A — Model skill (advisory)

- **Mechanism:** a SKILL.md that says "run IDE inspections after edits."
- **Pros:** zero code, model can adapt.
- **Cons:** skipped exactly when busy/uncertain; not auditable; **already failed in practice**.
- **Verdict:** keep the skill as *documentation*, but it cannot be the enforcement.

### Option B — Adapter-enforced post-turn inspection (proposed)

- **Mechanism:** after each `session/prompt` `end_turn`, the adapter runs `lint_files` on changed files via its own bridge connection, persists a report, surfaces a summary.
- **Pros:** deterministic, independent of the model, reuses existing tools, bounded.
- **Cons:** per-turn cost; adapter takes on a new responsibility.
- **Verdict:** the only deterministic option available today (given the auth + single-client IPC constraints).

### Option C — Host-side (let IntelliJ report diagnostics)

- **Mechanism:** the IDE already shows inspections; hypothetically stream them to the agent.
- **Pros:** no adapter work; IDE-native.
- **Cons:** ACP has no diagnostics channel; would require IntelliJ-side changes we don't control; the agent may ignore them anyway.
- **Verdict:** out of our control; complement, not replacement.

### Option D — CI gate only

- **Mechanism:** eslint/tsc in CI.
- **Pros:** standard, deterministic.
- **Cons:** outside the agent loop; feedback is delayed to push/PR; doesn't exercise the IDE bridge (the "effort" the user wants not wasted).
- **Verdict:** keep, but it does not solve the stated problem.

### Option E — Executor/pi-fabric hook

- **Mechanism:** bake the gate into `fabric_exec` or pi-fabric.
- **Pros:** would fire on every tool call.
- **Cons:** pi-fabric is host-agnostic; it has no ACP turn boundary and no IDE connection; would require a fork for a JetBrains-only concern.
- **Verdict:** wrong layer (confirmed by reading `skill-prompt.js` / `runtime-paths.js` / `mcp-ipc.js`).

### Comparison matrix

| | Deterministic | Uses IDE engine | No runtime fork | Per-turn | Auditable |
| --- | --- | --- | --- | --- | --- |
| A Skill | no | maybe | yes | — | weak |
| B Adapter hook | **yes** | **yes** | **yes** | **yes** | **yes** |
| C Host diagnostics | partial | yes | yes | no | weak |
| D CI | yes | no | yes | no | yes |
| E pi-fabric hook | yes | no | **no** | partial | yes |

---

## 8. Recommended architecture (detailed)

### 8.1 Components

```text
src/acp/mcp-bridge.ts   + hasRemoteTool(name): boolean
                        + callRemoteTool(name, args, timeoutMs): Promise<unknown>
                          (reuses existing #callTool plumbing: exposedName → connectionId →
                           SseMcpClient/StdioMcpClient.request('tools/call', …))

src/acp/session.ts      + expose bridge (getter) and cwd for the enforcement call

src/acp/ide-inspection.ts  (new)
   collectChangedFiles(cwd)            → git status --porcelain → filtered file list
   runEnforcedInspection(bridge, cwd, sessionId)
        → guard: bridge has get_file_problems/lint_files
        → lint_files(changed files)   (single batched call)
        → aggregate {filesChecked, errors, warnings}
        → write redacted report .pi/work/ide-inspections/<sessionId>/<ts>.{json,md}
        → return report (or {skipped, reason})

src/acp/agent.ts        + after session.prompt() returns 'end_turn', call
                          runEnforcedInspection(...), emit session/update summary,
                          include summary in PromptResponse._meta
```

### 8.2 The turn hook

The exact insertion point is after the existing prompt-result mapping in `agent.ts` (the code that already maps `result` to `stopReason`). Enforcement runs only for `end_turn` (the agent actually did work), never for `cancelled`/`error`.

### 8.3 Behavior defaults

1. **On by default** when the bridge has IDE tools; `PI_ACP_ENFORCE_IDE_INSPECT=0` opts out.
2. **Trigger:** every `end_turn`.
3. **Scope:** tracked, inspectable files changed since `HEAD` (bounded: e.g. ≤ 200 files; timeout ~30s).
4. **Delivery:** persisted report (durable) + `session/update` summary + `_meta`.
5. **Failure = graceful:** no bridge / no git / no IDE tools → one-line diagnostic, session continues.
6. **Severity policy:** ERROR findings are surfaced loudly; WARNING findings are recorded but do not block.

### 8.4 Why this is the minimum viable enforcement

- It exercises the IDE bridge on every turn (the "effort not wasted" requirement).
- It is independent of model behavior (the "not a skill" requirement).
- It adds no protocol surface, no new linter, no fork (the "not inventing shit" requirement).

---

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Per-turn latency | slow turns | changed-file filter, file cap, timeout, flag |
| Warning noise | report spam | separate ERROR vs WARNING; report only summaries in-chat |
| Untracked/giant files | inspect junk | filter by extension + size; `git status` tracked changes |
| Redaction | leaking paths/secrets | reuse existing `sanitizeBridgeDescriptors` redaction |
| Stale catalog (no tools) | gate silently no-ops | emit a diagnostic (consistent with existing F-023 handling) |
| Non-IntelliJ hosts | no bridge | graceful skip — enforcement is conditional on bridge presence |
| Model ignores findings | enforcement "wasted" | report is durable + surfaced; stronger feedback is a follow-up (inject findings into next prompt) |

---

## 10. What this is explicitly NOT

- **Not** a new ACP message type (no protocol change).
- **Not** a replacement for IntelliJ's own inspections (it *invokes* them).
- **Not** a fork of `pi-fabric` or `pi-coding-agent` (zero runtime changes).
- **Not** a substitute for CI (complementary: per-turn + pre-merge).
- **Not** a model-in-the-loop gate (the model may or may not read it; the gate still runs and records).

---

## 11. Recommendation

1. **Implement Option B** (adapter-enforced post-turn inspection) as the deterministic enforcement.
2. **Keep the skill** as documentation/on-demand guidance, registered in the repo's skill catalog — but treat it as *supplementary*, not the guarantee.
3. **Keep CI** for merge-time gates.
4. **Do not fork** any runtime; the change is confined to `src/acp/` in this repo.
5. **Future follow-ups** (explicitly out of scope now): inject ERROR findings into the next prompt so the model is nudged to fix; a `session/close` final sweep; config-driven file patterns.

---

## 12. Open questions

1. Should enforcement **also** run a final sweep on `session/close`, or is per-turn sufficient?
2. Should ERROR findings be **injected into the next prompt** (strong enforcement) or only surfaced (weak enforcement)?
3. What is the right **file-pattern default** (all changed files vs `src/**` vs extension allowlist)?
4. Should the report live in the **session cwd** (`.pi/work/ide-inspections/`) or a global agent dir?
5. Should the flag default be **on** or **opt-in** for the first release (rollout safety vs "enforce")?

---

## 13. Appendix — evidence and findings

### 13.1 Verified facts (live probes)

```text
GET http://127.0.0.1:64442/sse → 401 "restricted mode; provide valid authorization token"
/proc/41966/environ, /proc/46241/environ → no IJ_MCP_SERVER_* (descriptor arrives via session/new, not env)
idea.log debug dump → {"name":"idea","command":"idea.sh","env":[IJ_MCP_SERVER_PROJECT_PATH, IJ_MCP_SERVER_PORT=64442, IJ_MCP_AUTH_TOKEN=<redacted>]}
McpIpcServer.#accept → destroys second connection (single-client)
extensions.ide_idea_get_file_problems({filePath:"src/acp/agent.ts"}) → 1 WARNING (line 1479)
extensions.ide_idea_lint_files({files:[…6 files…]}) → 4 WARNINGs, 0 ERRORs
pi-fabric dist/core: skill-prompt.js, skill-references.js, skill-dir.js, runtime-paths.d.ts
pi-coding-agent dist/core/skills.js → owns .pi/skills + packs.json + manifest.json visibility
```

### 13.2 Mapping to the existing findings ledger

| Finding | Status | How this research relates |
| --- | --- | --- |
| F-021 "Invoke IDE tools end to end" | Open | This is the deterministic close |
| F-030 "Persist IDE inspection evidence" | Open | The report file closes it |
| F-033 "Require fresh-chat release acceptance" | Open | Enforcement removes the manual fresh-chat dependency for the inspection item |
| F-006 "Dogfood non-empty MCP descriptors" | Resolved (fixture smoke) | Unchanged |
| F-023 "Clarify tools/list_changed" | Open | Unchanged; enforcement must tolerate stale/immutable catalogs |

### 13.3 Key file inventory (read during this research)

```text
node_modules/@agentclientprotocol/sdk/dist/schema/types.gen.d.ts
node_modules/@agentclientprotocol/sdk/dist/acp.d.ts
node_modules/@agentclientprotocol/sdk/README.md
src/acp/agent.ts
src/acp/session.ts
src/acp/mcp-bridge.ts
src/acp/mcp-sse.ts
src/acp/mcp-stdio.ts
src/acp/mcp-ipc.ts
src/pi-extension/acp-mcp-bridge.ts
docs/findings/2026-08-14-jetbrains-acp-dogfood-findings.md
~/.pi/agent/npm/node_modules/pi-fabric/{dist/core/skill-*.js, runtime-paths.d.ts, package.json}
~/.pi/agent/npm/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js
~/.local/share/JetBrains/*/{platform-acp-plugin, ml-llm/…acp*.jar}
scripts/smoke-mcp-fixture.mjs
scripts/dogfood-ide.mjs
scripts/sync-skill-manifest.mjs
scripts/validate-skill-packs.mjs
```

### 13.4 One-line conclusion

> Adapter-enforced IDE inspection is a deterministic, per-turn quality gate implemented at the only layer with the authority to run it (authenticated IDE connection + turn boundary). It reuses the IDE's own inspection engine and the existing MCP surface, adds no protocol, no linter, and no runtime fork — so it is **not** reinventing anything; it is finally *closing* what F-021/F-030/F-033 already identified as missing.

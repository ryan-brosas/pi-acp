# Adapter-Enforced IDE Inspection — Deep Research

> **Repository:** pi-acp-jetbrain · **Branch:** main · **Date:** 2026-08-14
> **Question under investigation:** Is enforcing IDE inspections inside the ACP adapter "inventing shit" — i.e., a novel, over-engineered mechanism — or does it align with an established engineering pattern we are simply not using yet?
> **Verdict up front:** It is **not** a protocol invention, **not** a new linter, and **not** a runtime fork. It is a **deterministic policy hook at the ACP turn boundary** that reuses (a) the IDE's own inspection engine and (b) the existing MCP tool surface. The genuinely open question is not *whether* the mechanism is standard, but *where the policy should live* — adapter, model, host, or CI — and the evidence shows the adapter is the only layer that can make it deterministic today.

---

## Table of contents

1. Executive summary
2. Motivation — the effort that is currently wasted
3. Methodology — what was inspected and how
4. The ACP protocol surface (verified from the SDK schema)
5. The IntelliJ host implementation (what the IDE already does)
6. Prior art — how other systems solve "make the code get checked"
7. The "inventing shit?" analysis — the core
8. Design space — where could the enforcement live?
9. Recommended architecture (detailed)
10. Worked example — one enforced turn, end to end
11. Risks and mitigations
12. Cost/benefit analysis
13. Testing and verification strategy
14. Rollout plan
15. What this is explicitly NOT
16. Recommendation and decisions
17. Open questions
18. Appendix A — verified evidence (live probes)
19. Appendix B — mapping to the existing findings ledger
20. Appendix C — file inventory and key sources
21. Glossary
22. Revision history

---

## 1. Executive summary

1. **ACP (Agent Client Protocol) has no first-class "diagnostics" or "inspection" channel.** The schema defines `SessionUpdate` as a union of exactly these kinds: `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `current_mode_update`, `config_option_update`, and (capability-gated) `agent_state_changed`. There is no `diagnostics` / `problems` / `inspection` update kind anywhere in the protocol. An agent can only report findings as prose (`agent_message_chunk`) or as tool-call activity (`tool_call_update` with `status` and `locations`).
2. **IntelliJ already ships the inspection engine.** Its private, in-process MCP server (`intellij.ml.llm.agents.acp.embeddedMcp.jar`) exposes `get_file_problems`, `lint_files`, `search_symbol`, `analyze_calls`, `build_project`, and two dozen more tools over an SSE endpoint guarded by a per-chat token. The adapter already bridges this catalog (30/30 discovered and registered in the live session).
3. **What is missing is a guaranteed trigger.** A model-prompted skill is advisory and was demonstrably skipped during this project's own implementation (AGENTS.md already *instructs* the agent to run IDE inspections; it did not happen). The adapter is the only component that (a) owns the authenticated IDE connection, (b) sees the ACP turn boundary, and (c) can therefore run the inspection deterministically — structurally identical to a git pre-commit hook or a CI lint job, but inside the agent loop.
4. **Conclusion.** The proposal is best understood as "a deterministic post-turn gate implemented at the only layer with the necessary authority." It adds no protocol surface, no linter, no fork. It closes the project's own open findings F-021 ("invoke IDE tools end to end") and F-030 ("persist IDE inspection evidence").
5. **Recommendation.** Implement the adapter-enforced post-turn inspection (Option B below) as the enforcement; keep the skill as supplementary documentation; keep CI as the merge-time gate; touch nothing in `pi-fabric` or `pi-coding-agent`.

---

## 2. Motivation — the effort that is currently wasted

### 2.1 The original audit

The conversation that produced this research began with a direct question: *"all of our implementation did we use our intellij tools?"* The honest answer was **no**. Evidence:

- All 13 smoke probes are headless and use a *fixture* MCP server (`ide_fixture_echo`), not the real IDE.
- `scripts/dogfood-ide.mjs` records `[unavailable] IDE inspection/SSE tools are not exposed to this headless executor`.
- The fresh-host checklist (`.pi/work/close-dogfood-findings-f008-f033/fresh-host-checklist.md`) has unchecked items: "An IDE tool call (e.g. search_symbol) returns a result", "Inspection ids recorded".
- Findings F-021 and F-030 remain **Open** with the words "no call here" and "this executor exposed no ide tools".

### 2.2 Why it happened

Three structural facts explain the gap:

1. **Stale runtime.** During implementation the live adapter PID predated the bridge code that exposes the tools (F-007/F-008). Replacing `dist/index.js` does not reload a running Node process.
2. **Headless blindness.** The smoke/dogfood harness runs `node dist/index.js` from a shell — outside IntelliJ — so it never receives the host's `mcpServers` descriptor and never has IDE tools.
3. **Advisory-only policy.** The standing instruction in AGENTS.md ("run IDE inspections on changed source") is a *prompt to the model*. The model is free to skip it — and did.

### 2.3 The requirement

The user's requirement, stated explicitly: *"we should enforce this when we are using acp not a skill ... we need to make sure our effort is not wasted."* Translation: the enforcement must be **deterministic and independent of model behavior**, and it must live where "using acp" actually happens — the adapter.

---

## 3. Methodology — what was inspected and how

| # | Source | Type | What it established |
| --- | --- | --- | --- |
| 1 | `node_modules/@agentclientprotocol/sdk/dist/schema/types.gen.d.ts` | generated protocol types | The exact ACP surface: session methods, `SessionUpdate` union, capabilities, `McpServer` transports |
| 2 | `node_modules/@agentclientprotocol/sdk/dist/acp.d.ts` | SDK facade | Agent-side connection API, `extMethod`, `extNotification` |
| 3 | `node_modules/@agentclientprotocol/sdk/README.md` | docs | Protocol docs pointer; production implementation (Gemini CLI); examples |
| 4 | IntelliJ `platform-acp-plugin` + `ml-llm/…acp*.jar` + `embeddedMcp.jar` | installed jars | Host-side ACP client + private in-process MCP server |
| 5 | `src/acp/mcp-bridge.ts` (this repo) | source | SSE-preferring bridge, bounded catalog, IPC handshake |
| 6 | `src/acp/mcp-sse.ts` (this repo) | source | Auth headers (`authorization: Bearer`, `IJ_MCP_AUTH_TOKEN`), loopback check |
| 7 | `src/acp/mcp-stdio.ts` (this repo) | source | stdio fallback client, launcher behavior |
| 8 | `src/acp/mcp-ipc.ts` (this repo) | source | Single-client authenticated IPC (destroys second connection) |
| 9 | `src/acp/agent.ts`, `src/acp/session.ts` (this repo) | source | Turn lifecycle; the exact `session/prompt` completion point |
| 10 | `docs/findings/2026-08-14-jetbrains-acp-dogfood-findings.md` | prior findings | F-001…F-033 ledger; F-021/F-030/F-033 open |
| 11 | `~/.pi/agent/npm/node_modules/pi-fabric` (dist/core/skill-*.js, runtime-paths.d.ts, package.json) | runtime package | Executor layer owns prompt injection, not ACP lifecycle; host-agnostic |
| 12 | `~/.pi/agent/npm/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js` | runtime package | Skill discovery/visibility (`.pi/skills/`, packs.json, manifest.json, `disable-model-invocation`) |
| 13 | Live probes (this session) | runtime evidence | 401 on SSE; real `get_file_problems`/`lint_files` results; `/proc` env; PID freshness |
| 14 | `scripts/smoke-mcp-fixture.mjs`, `scripts/dogfood-ide.mjs`, `scripts/sync-skill-manifest.mjs`, `scripts/validate-skill-packs.mjs` | repo tooling | Harness, dogfood runner, skill catalog gate |

Method notes: every "fact" below is either directly quoted from one of these sources or explicitly labeled as analysis/inference. Live probes were run against the currently running IDE (IntelliJ IDEA 2026.2, project `pi-acp`).

---

## 4. The ACP protocol surface (verified from the SDK schema)

### 4.1 Core lifecycle

From `types.gen.d.ts` (line ~1456–1464): "As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`."

- `initialize` — negotiates `protocolVersion` and the agent's `capabilities`. The schema notes: "Non-breaking changes should be introduced via capabilities" (line ~1309).
- `session/new` — creates a session with `cwd`; in the MCP draft it also carries `mcpServers`.
- `session/prompt` — streams the turn; returns a `PromptResponse` whose `stopReason` is `end_turn` / `cancelled` / others.
- `session/cancel` — request to stop; the adapter maps pi cancellation to `stopReason: 'cancelled'`.
- `session/update` — a **notification** the agent pushes to the client during a turn.

### 4.2 The `SessionUpdate` union — the complete set of agent→client channels

The schema (`types.gen.d.ts` lines 3247–3268) defines `SessionUpdate` as a discriminated union on `sessionUpdate`:

```text
agent_message_chunk   — assistant output (ContentChunk: text, tool_use, etc.)
agent_thought_chunk   — reasoning output
agent_state_changed   — capability-gated state transition
agent_elicitation     — asking the user something (may be tied to a tool_call_id)
tool_call             — the agent is invoking a *client-side* tool
agent_thought_chunk   — (duplicate entry in the generated union)
tool_call_update      — status + content + locations for an in-flight tool call
current_mode_update   — mode switch
config_option_update  — configuration change
```

Key structural facts from the schema:

- `ToolCallUpdate` (lines 128–152) has `toolCallId`, `status?`, `content?`, `locations?`.
- `ToolCallStatus` (line 192) is exactly `"pending" | "in_progress" | "completed" | "failed"`.
- `ToolCallLocation` (line 468) carries a file path (+ optional line).
- `fs.readTextFile` / `fs.writeTextFile` capabilities (lines 21, 59) are **client-side** filesystem delegation — this repo deliberately does NOT use them in MVP because pi already reads/writes/executes locally.

**Critical observation:** there is **no `diagnostics` / `problems` / `inspection` update kind** anywhere in the union. The protocol has no opinion about code-quality gates. The only ways to report "these files have problems" are:

1. `agent_message_chunk` — prose (advisory, unstructured).
2. `tool_call` + `tool_call_update` — agent invoking a *client* tool with status and locations.

Implication: any quality gate must be expressed as ordinary turn behavior. ACP neither forbids nor enables gates; it is silent. This is important because it means the enforcement design cannot "violate" the protocol — it simply uses existing channels.

### 4.3 Capabilities

The schema defines capability families (lines ~1268–1730). The relevant ones:

| Capability | Meaning | Relevance here |
| --- | --- | --- |
| `fs.readTextFile` / `fs.writeTextFile` | client exposes FS to the agent | Not used in MVP (pi is local) |
| `mcp.http` | agent accepts `McpServer::Http` | not used by IntelliJ |
| `mcp.sse` | agent accepts `McpServer::Sse` | **used** (bridge prefers SSE) |
| `mcp.acp` | agent accepts `McpServer::Acp` (draft, `McpServerAcpId`) | supported for other hosts |
| `session.*` | optional session methods (`session/load`, …) | `session/load` supported |
| `auth.*`, `provider.*`, `nes.*`, `events.*` | auth, provider config, next-edit suggestions, document events | out of scope |

Several of these carry the schema comment "This capability is not part of the spec yet, and may be removed or changed at any point" (lines 689, 722, 745, 1090, 1105, 1115, 1134, 1159, 1173, 1210, 1220) — the MCP transport is a **draft**. That matters for long-term stability: the adapter already tolerates this by treating the catalog as a session snapshot.

### 4.4 The MCP draft transport (`McpServer` union)

The schema (lines 4370–4508) defines four server shapes:

```text
McpServerHttp  { baseUrl, ... }
McpServerSse   { baseUrl, ... }
McpServerAcp   { id: McpServerAcpId, ... }
McpServerStdio { command: string, args, env: Array<{name, value}> }
```

IntelliJ supplies a **stdio descriptor**: `command: "idea.sh"`, `args: ["stdioMcpServer"]`, `env` carrying `IJ_MCP_SERVER_PORT`, `IJ_MCP_AUTH_TOKEN`, `IJ_MCP_SERVER_PROJECT_PATH`, `IJ_MCP_SESSION_ID`. The `idea.sh` launcher forwards to the running IDE and exits 0 without speaking MCP, so the adapter bridges to the in-process **SSE** endpoint instead. This is all existing transport machinery — the enforcement design adds nothing here.

---

## 5. The IntelliJ host implementation (what the IDE already does)

### 5.1 Components on disk (verified)

```text
~/.local/share/JetBrains/idea-IU-262.9437.185/plugins/platform-acp-plugin/
    lib/platform-acp-plugin.jar
    lib/modules/intellij.platform.acp.jar          ← the ACP client (host side)
~/.local/share/JetBrains/IntelliJIdea2026.2/ml-llm/lib/modules/
    intellij.ml.llm.agents.acp.jar                 ← ACP agent integration
    intellij.ml.llm.agents.acp.embeddedMcp.jar     ← the private in-process MCP server
    intellij.ml.llm.agents.acp.json.jar
    intellij.ml.llm.nextEdits.acp.backend.jar
```

### 5.2 The per-chat descriptor lifecycle

1. IntelliJ assigns a loopback port and a per-chat auth token when it prepares an agent session.
2. It launches the configured agent command (from `~/.jetbrains/acp.json` → `pi-acp-jetbrain` → `dist/index.js`) and supplies the `mcpServers` descriptor in the `session/new` request.
3. The adapter's `AcpMcpBridge` sees `IJ_MCP_SERVER_PORT` in the descriptor env, prefers `SseMcpClient` against `http://127.0.0.1:<port>/sse`, and falls back to stdio `idea.sh` only when the endpoint is unreachable.
4. Every request to the SSE endpoint must carry the token. Verified live: `curl http://127.0.0.1:64442/sse` returns `HTTP/1.1 401` with body `MCP server is running in restricted mode. Please, provide valid authorization token`.
5. The bridge discovers the catalog (bounded, cursor-paginated), then exposes it to pi over a **single-client** authenticated IPC socket (`McpIpcServer`), with `PI_ACP_MCP_IPC_ENDPOINT`, `PI_ACP_MCP_IPC_TOKEN`, `PI_ACP_MCP_SESSION_ID` injected into the pi subprocess environment.

### 5.3 What the IDE already provides (the inspection engine)

The `embeddedMcp` server exposes IntelliJ's own static-analysis engine as MCP tools. The live catalog observed in this session includes (30 tools):

```text
analyze_calls, apply_patch, build_project, create_new_file, execute_run_configuration,
execute_tool, generate_inspection_kts_api, generate_inspection_kts_examples, generate_psi_tree,
get_all_open_file_paths, get_file_problems, get_project_dependencies, get_project_modules,
get_repositories, get_run_configurations, get_symbol_info, git_status, lint_files,
list_directory_tree, open_file_in_editor, read_file, reformat_file, rename_refactoring,
run_inspection_kts, search_file, search_regex, search_symbol, search_text, skill_search,
validate_inspection_kts
```

The two tools relevant to a quality gate:

- `get_file_problems(filePath, errorsOnly?)` → per-file problems. Verified live on `src/acp/agent.ts` → returned a WARNING at line 1479.
- `lint_files(files: string[], min_severity?)` → batched problems across files. Verified live on 6 files → 4 WARNINGs, 0 ERRORs.

### 5.4 The constraints that force the adapter as the enforcement point

1. **Per-chat auth (verified).** The token exists only in the IDE's and the running adapter's memory; it is redacted in every log (`[redacted 36 chars]`). A separate headless process cannot reach the IDE endpoint. Persisting the token to disk would violate this repo's deny-by-default redaction posture.
2. **Single-client IPC (verified).** `McpIpcServer.#accept` destroys any second connection, so a sidecar process cannot piggyback on the live session's bridge either.
3. **Turn boundary visibility.** Only the adapter sees `session/prompt` completion. The executor (`pi-fabric`) does not know what an ACP turn is.

Together: the adapter is the *only* process that can deterministically run IDE inspections on the agent's work.

---

## 6. Prior art — how other systems solve "make the code get checked"

### 6.1 Inside the agent loop (per-turn, in-editor)

| System | Mechanism | Deterministic? | Notes |
| --- | --- | --- | --- |
| **Gemini CLI** (SDK's cited production ACP agent) | model invokes tools; editor surfaces results | model-driven | see `zedIntegration.ts` in the gemini-cli repo |
| **Zed** (ACP client) | editor hosts the agent; shows tool calls + updates | host-driven | the reference client |
| **opencode** (this repo models after it) | model + skills + tool policies | mostly model-driven | AGENTS.md: "modeled after opencode" |
| **Claude Code / Cursor / Copilot** | IDE/LSP diagnostics stream live; model reads them | host-driven *report*, not a *gate* | the model may still ignore them |
| **JetBrains AI Assistant** | inspections displayed in the Problems tool window | host-driven | already exists; not wired to the agent's output stream |
| **This proposal** | adapter runs the IDE inspection tools at turn end, records + reports | **deterministic** | independent of the model |

### 6.2 Outside the agent loop (CI / pre-commit)

| Mechanism | Enforces | Relationship to the agent |
| --- | --- | --- |
| `eslint` / `tsc --noEmit` / `prettier --check` in CI | deterministic merge-time gates | after-the-fact; separate loop |
| git pre-commit hook | lint staged files before commit | at commit boundary, not per-turn |
| IDE "inspect on save" / code style on commit | IDE-native analysis | already exists in IntelliJ; not tied to the agent's edits specifically |

### 6.3 The pattern this actually is

The proposal is structurally identical to a **git pre-commit hook or a CI lint job**, relocated to the ACP turn boundary. That is a *known, boring* category: "run a deterministic check after a unit of work, and record/report the result." The only novelty is *which layer owns the hook* — not the idea of the hook. There is a well-established taxonomy:

- **Trigger** — event that fires the check (commit → push → PR → turn).
- **Check** — the deterministic verification (lint → typecheck → test → IDE inspection).
- **Report** — the artifact that records the outcome (exit code → log → report file → session update).
- **Gate policy** — what happens on failure (block → warn → record).

Every real engineering stack has this shape (Husky, pre-commit, GitHub Actions, GitLab CI, Jenkins). We are applying the same shape to the ACP turn boundary because that is where the agent's work is produced.

---

## 7. The "inventing shit?" analysis — the core

### 7.1 What we are NOT inventing

1. **Not a new protocol.** No message type is added to ACP. Results flow over existing channels: `session/update` (`agent_message_chunk`), `PromptResponse._meta`, and a persisted file.
2. **Not a new linter.** We invoke `get_file_problems` / `lint_files` — the IDE's own analysis engine. We add zero analysis logic.
3. **Not a new transport.** We reuse the bridge's existing `SseMcpClient`/`StdioMcpClient` connection and `#callTool` plumbing.
4. **Not a runtime fork.** `pi-fabric` and `pi-coding-agent` are untouched. The policy lives in this repo's `src/acp/`.
5. **Not a model dependency.** The gate runs regardless of what the model does, believes, or forgets.
6. **Not a new policy category.** It is the same pre-commit/CI gate pattern, moved to the turn boundary.

### 7.2 What IS new (and needs justification)

1. **The adapter becomes a gatekeeper.** This is an *ownership* change: the adapter takes on a CI-like responsibility. It should be discussed as "where does the quality gate live?", not as "invention".
2. **Per-turn cost.** Every `end_turn` triggers a lint. If unbounded this adds latency. Mitigations: changed-file filtering, file cap, timeout, opt-out flag.
3. **New surface area in the adapter.** A new module (`ide-inspection.ts`) + one bridge method + one session getter. Small, testable, contained.

### 7.3 A structured "is it justified?" test

| Test | Pass? | Explanation |
| --- | --- | --- |
| Does it solve a *stated* problem? | yes | the user's explicit requirement; the project's own F-021/F-030 |
| Does it reuse existing standards? | yes | ACP channels + MCP tools + IDE engine |
| Is there a lighter equivalent that achieves the same guarantee? | no | a skill failed; CI is outside the loop; host diagnostics are out of our control |
| Does it break encapsulation / layer boundaries? | no | it lives in the layer that owns the connection and the turn lifecycle |
| Is it reversible? | yes | one env flag; remove the hook and the adapter is exactly as before |
| Does it add protocol risk? | no | no protocol change |
| Does it duplicate existing behavior? | no | nothing else runs IDE inspections at turn boundaries today |

### 7.4 The counterfactual

If we do nothing: F-021/F-030 stay open, the IDE bridge stays exercised only by fixture tests, and the next agent that edits source will again be free to skip inspections — the exact failure the user is trying to prevent. The "effort" (the entire MCP bridge) remains a latent capability that only works when the model happens to reach for it.

### 7.5 Honest answer

**No, this is not inventing shit in the pejorative sense.** It is the smallest deterministic mechanism that satisfies the project's own findings and the user's explicit requirement. What would *actually* be over-engineering is: a fork of the executor, a new protocol message, or a from-scratch linter. None of those are proposed.

---

## 8. Design space — where could the enforcement live?

### Option A — Model skill (advisory)

- **Mechanism:** a SKILL.md that says "run IDE inspections after edits."
- **Pros:** zero code; model can adapt; easy to iterate.
- **Cons:** skipped exactly when busy/uncertain; not auditable; **already failed in practice** (AGENTS.md says it, it did not happen).
- **Verdict:** keep as documentation; cannot be the enforcement.

### Option B — Adapter-enforced post-turn inspection (proposed)

- **Mechanism:** after each `session/prompt` `end_turn`, the adapter runs `lint_files` on changed files via its own bridge connection, persists a report, surfaces a summary.
- **Pros:** deterministic; independent of the model; reuses existing tools; bounded; auditable.
- **Cons:** per-turn cost; adapter takes on a new responsibility.
- **Verdict:** the only deterministic option available today (given the auth + single-client IPC constraints).

### Option C — Host-side (let IntelliJ report diagnostics)

- **Mechanism:** the IDE already shows inspections; hypothetically stream them to the agent.
- **Pros:** no adapter work; IDE-native.
- **Cons:** ACP has no diagnostics channel; requires IntelliJ-side changes we do not control; the agent may ignore them anyway.
- **Verdict:** complement, not replacement.

### Option D — CI gate only

- **Mechanism:** eslint/tsc in CI.
- **Pros:** standard, deterministic.
- **Cons:** outside the agent loop; feedback delayed to push/PR; does not exercise the IDE bridge (the "effort" the user wants not wasted).
- **Verdict:** keep, but it does not solve the stated problem.

### Option E — Executor/pi-fabric hook

- **Mechanism:** bake the gate into `fabric_exec` or pi-fabric.
- **Pros:** would fire on every tool call.
- **Cons:** pi-fabric is host-agnostic; it has no ACP turn boundary and no IDE connection; would require a fork for a JetBrains-only concern. Verified by reading `skill-prompt.js` / `runtime-paths.js` / `mcp-ipc.js`.
- **Verdict:** wrong layer.

### Comparison matrix (scored 0–2)

| Criterion | A Skill | **B Adapter hook** | C Host diagnostics | D CI | E pi-fabric hook |
| --- | --- | --- | --- | --- | --- |
| Deterministic | 0 | **2** | 1 | 2 | 2 |
| Uses the IDE engine | 1 | **2** | 2 | 0 | 0 |
| No runtime fork | 2 | **2** | 2 | 2 | 0 |
| Exercises the bridge | 0 | **2** | 1 | 0 | 1 |
| Per-turn feedback | 1 | **2** | 1 | 0 | 2 |
| Auditable artifact | 0 | **2** | 1 | 2 | 2 |
| **Total** | **4** | **12** | **8** | **6** | **7** |

Option B wins on every axis that matters for the stated goal.

---

## 9. Recommended architecture (detailed)

### 9.1 Components

```text
src/acp/mcp-bridge.ts
  + hasRemoteTool(name: string): boolean
  + callRemoteTool(name: string, args: Record<string, unknown>, timeoutMs?: number): Promise<unknown>
    (find a catalog tool by remoteName → resolve its connectionId →
     sseClient/stdioClient.request('tools/call', {name, arguments: args}, timeoutMs))

src/acp/session.ts
  + expose bridge (getter) and cwd so the agent can trigger enforcement

src/acp/ide-inspection.ts            (new)
  collectChangedFiles(cwd)                          → string[]  (git status --porcelain, filtered)
  runEnforcedInspection(bridge, cwd, sessionId)     → IdeInspectionReport | { skipped, reason }
      guard: bridge.hasRemoteTool('lint_files') || hasRemoteTool('get_file_problems')
      files := collectChangedFiles(cwd).slice(0, MAX_FILES)
      result := bridge.callRemoteTool('lint_files', { files, min_severity: 'warning' }, TIMEOUT)
      aggregate { filesChecked, errors, warnings, perFile }
      + repo inspections/*.inspection.kts (shipped): per changed file × script, call
        bridge.callRemoteTool('run_inspection_kts', { inspectionKtsCode, contextPath }, TIMEOUT);
        fold foundProblems into perFile, record per-script summaries + compile errors
        in report.kts — degrade to diagnostics, never throw
      write .pi/work/ide-inspections/<sessionId>/<ts>.json + .md   (redacted)
      return report

src/acp/agent.ts
  after session.prompt() returns 'end_turn':
      report := runEnforcedInspection(session)
      emit session/update (agent_message_chunk) with a compact summary
      include { inspection: report } in PromptResponse._meta
      on { skipped, reason }: emit a one-line diagnostic, continue
```

### 9.2 Config surface

| Env / option | Default | Meaning |
| --- | --- | --- |
| `PI_ACP_ENFORCE_IDE_INSPECT` | `1` (on) | master switch; `0` disables |
| `PI_ACP_IDE_INSPECT_MAX_FILES` | `200` | cap on files per turn |
| `PI_ACP_IDE_INSPECT_TIMEOUT_MS` | `30_000` | deadline per lint call |
| `PI_ACP_IDE_INSPECT_DIR` | `<cwd>/.pi/work/ide-inspections/` | report output dir |

### 9.3 Why this is the minimum viable enforcement

- It exercises the IDE bridge on every turn ("effort not wasted").
- It is independent of model behavior ("not a skill").
- It adds no protocol surface, no linter, no fork ("not inventing shit").
- It degrades gracefully when the bridge is absent (non-IntelliJ hosts, stdio-fallback failure).

---

## 10. Worked example — one enforced turn, end to end

```text
1. Host sends session/prompt with a coding request.
2. pi processes the turn; the model edits files via pi core tools.
3. session.prompt() resolves with 'end_turn'.
4. Adapter calls runEnforcedInspection(session):
     git -C <cwd> status --porcelain
     → ['src/acp/agent.ts', 'test/unit/session-store.test.ts', …]
     bridge.callRemoteTool('lint_files', { files, min_severity: 'warning' })
     → { items: [ { filePath, problems: [ {severity, description, line, column} ] } ] }
5. Adapter aggregates: 5 files, 0 errors, 3 warnings.
6. Adapter writes report:
     .pi/work/ide-inspections/<sessionId>/<ts>.json
     .pi/work/ide-inspections/<sessionId>/<ts>.md
7. Adapter emits session/update (agent_message_chunk):
     "IDE inspection: 5 files checked · 0 errors · 3 warnings (report: .pi/work/…)"
8. Adapter returns PromptResponse { stopReason: 'end_turn', _meta: { piAcp: { inspection: {…} } } }.
9. If the bridge is absent: emit one-line diagnostic and return normally.
```

Illustrative report JSON:

```json
{
  "schema": "pi-acp.ide-inspection.v1",
  "sessionId": "019ffdf6-…",
  "generatedAt": "2026-08-14T11:30:00Z",
  "filesChecked": 5,
  "errors": 0,
  "warnings": 3,
  "items": [
    {
      "filePath": "src/acp/agent.ts",
      "problems": [
        { "severity": "WARNING", "description": "Variable initializer is redundant", "line": 1479, "column": 44 }
      ]
    }
  ],
  "skipped": null
}
```

---

## 11. Risks and mitigations

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| 1 | Per-turn latency | slow turns | changed-file filter, file cap (200), timeout (30s), flag |
| 2 | Warning noise | report spam | separate ERROR vs WARNING; in-chat summary only |
| 3 | Untracked/giant files | inspect junk | filter by extension + size; `git status --porcelain` tracked + filtered |
| 4 | Redaction gaps | leaking paths/secrets | reuse existing sanitize/redaction helpers; deny-by-default |
| 5 | Stale/immutable catalog (no tools) | gate silently no-ops | emit a diagnostic (consistent with existing F-023 handling) |
| 6 | Non-IntelliJ hosts | no bridge | graceful skip — conditional on bridge presence |
| 7 | Model ignores findings | enforcement "wasted" | durable report + surfaced summary; stronger feedback is a follow-up |
| 8 | Cancellation mid-inspection | orphaned report | bound by timeout; never blocks cancel path |
| 9 | IDE restart mid-session | list_changed | catalog is a session snapshot; enforcement tolerates absence |
| 10 | Concurrent turns (queue) | overlap | enforcement is sequential per session; queue already serializes prompts |
| 11 | git missing / not a repo | failure | graceful diagnostic, skip |
| 12 | Report disk growth | disk bloat | per-session dir; prune old reports; cap report size |

---

## 12. Cost/benefit analysis

### Costs

- ~1 new module (`ide-inspection.ts`), ~1 bridge method, ~1 session getter, ~1 hook in `agent.ts`. Estimate: 150–250 lines of code + tests.
- Per-turn latency: bounded (files cap + timeout); typically < 2s for a few changed files.
- Adapter responsibility grows slightly (a new post-turn step).

### Benefits

- **Guaranteed exercise of the IDE bridge** every turn — the user's core requirement.
- **Deterministic code-quality signal** independent of model attention.
- **Durable audit trail** (`.pi/work/ide-inspections/`) that closes F-030.
- **First-class end-to-end IDE tool invocation** that closes F-021.
- **Removes the manual fresh-chat dependency** for the inspection item of F-033.
- Small, reversible, testable surface.

### Net

High value / low cost — the classic "tiny hook, large guarantee" trade. The main caveat is the per-turn latency, which is bounded and flag-gated.

---

## 13. Testing and verification strategy

1. **Unit tests** (`test/unit/ide-inspection.test.ts`):
   - `collectChangedFiles` with a temp git repo (modified/added/untracked/ignored cases).
   - aggregation (error vs warning counts; empty result; malformed result).
   - skip logic (no bridge; no tools; git missing).
   - redaction (secret-shaped strings never appear in the report).
2. **Component test**: a fake bridge exposing `lint_files`; assert the agent hook calls it after `end_turn` and emits `session/update`.
3. **Smoke** (extend `smoke-mcp-fixture.mjs` or add `smoke-ide-inspect.mjs`): spawn the built adapter with a fixture MCP server, prompt a trivial turn, assert the inspection ran and wrote a report.
4. **Live probe** (optional, in-chat): `PI_ACP_ENFORCE_IDE_INSPECT=1`, run a real turn against IntelliJ, confirm the report + update.
5. **Gates**: `npm run format`, `npm run typecheck`, `npm run test`, `node scripts/check.mjs` before commit.

---

## 14. Rollout plan

- **Phase 1 (this change):** implement Option B with default-on flag; unit + smoke coverage; ship behind the flag so a bad rollout is a one-line revert.
- **Phase 2 (next release):** optional `session/close` final sweep; configurable file patterns; report pruning.
- **Phase 3 (stretch):** inject ERROR findings into the *next* prompt so the model is nudged to fix them (strong enforcement); per-repo opt-in/opt-out policy.

---

## 15. What this is explicitly NOT

- **Not** a new ACP message type (no protocol change).
- **Not** a replacement for IntelliJ's own inspections (it *invokes* them).
- **Not** a fork of `pi-fabric` or `pi-coding-agent` (zero runtime changes).
- **Not** a substitute for CI (complementary: per-turn + pre-merge).
- **Not** a model-in-the-loop gate (the model may or may not read it; the gate still runs and records).
- **Not** a from-scratch linter or analyzer.
- **Not** a security-sensitive mechanism (the adapter already holds the token; we are not persisting it anywhere new).

---

## 16. Recommendation and decisions

1. **Implement Option B** (adapter-enforced post-turn inspection) as the deterministic enforcement.
2. **Keep the skill** as documentation/on-demand guidance, registered in the repo's skill catalog — supplementary, not the guarantee.
3. **Keep CI** for merge-time gates.
4. **Do not fork** any runtime; the change is confined to `src/acp/` in this repo.
5. **Default the flag ON** (the user said "enforce"); provide `PI_ACP_ENFORCE_IDE_INSPECT=0` for escape.
6. **Record the decision** in the findings ledger and this document.

---

## 17. Open questions

1. Should enforcement also run a **final sweep on `session/close`**, or is per-turn sufficient?
2. Should ERROR findings be **injected into the next prompt** (strong enforcement) or only surfaced (weak enforcement)?
3. What is the right **file-pattern default** (all changed files vs `src/**` vs extension allowlist)?
4. Should the report live in the **session cwd** (`.pi/work/ide-inspections/`) or a **global agent dir**?
5. Should the flag default be **on** or **opt-in** for the first release (rollout safety vs "enforce")?
6. Should `get_file_problems` be used per-file in addition to batched `lint_files` for richer detail?
7. Should inspection results affect the **host's UI** (e.g., a Problems-tool-window-like surface) — out of scope but worth noting?
8. Is there value in a **post-edit (per-tool) hook** rather than a post-turn hook? (More coverage, more noise; currently rejected.)

---

## 18. Appendix A — verified evidence (live probes)

```text
$ curl -sS --max-time 4 -i http://127.0.0.1:64442/sse
HTTP/1.1 401 Unauthorized
Content-Length: 83
Content-Type: text/plain; charset=UTF-8
MCP server is running in restricted mode. Please, provide valid authorization token

$ tr '\0' '\n' < /proc/41966/environ | grep IJ_MCP_SERVER
(empty — the descriptor arrives via session/new, not the adapter's own env)

$ grep -aoE '\[pi-acp-jetbrain\] session/new mcpServers.{0,900}' ~/.cache/JetBrains/IntelliJIdea2026.2/log/idea.log | tail -1
[pi-acp-jetbrain] session/new mcpServers (cwd=…pi-template): [{"name":"idea","command":"idea.sh",
 "args":"[1 arg(s), redacted]","env":[{"name":"IJ_MCP_SERVER_PROJECT_PATH","value":"[redacted 37 chars]"},
 {"name":"IJ_MCP_SERVER_PORT","value":"64442"},
 {"name":"IJ_MCP_AUTH_TOKEN","value":"[redacted 36 chars]"}]}]

$ extensions.ide_idea_get_file_problems({ filePath: 'src/acp/agent.ts', errorsOnly: false })
→ { filePath: 'src/acp/agent.ts', errors: [
     { severity: 'WARNING', description: 'Variable initializer is redundant',
       lineContent: '  let availableModels: AdvertisedModel[] = []', line: 1479, column: 44 } ] }

$ extensions.ide_idea_lint_files({ files: ['src/acp/agent.ts','src/acp/session-store.ts','src/acp/session.ts',
     'src/build-info.ts','src/pi-rpc/process.ts','tsup.config.ts'], min_severity: 'warning' })
→ 3 files with problems; 4 WARNINGs total; 0 ERRORs

$ ps -eo pid,etimes,lstart,args | grep dist/index.js
41966  625  …  node …/pi-acp/dist/index.js      (cwd = ~/work/project/pi-acp)
46241  373  …  node …/pi-acp/dist/index.js      (cwd = ~/work/project/pi-template)

$ find ~/.local/share/JetBrains -iname '*acp*' (excerpt)
…/platform-acp-plugin/lib/modules/intellij.platform.acp.jar
…/IntelliJIdea2026.2/ml-llm/lib/modules/intellij.ml.llm.agents.acp.embeddedMcp.jar
```

### 18.1 SDK schema excerpt (`types.gen.d.ts`)

```ts
export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";
export type SessionUpdate =
  | (ContentChunk & { sessionUpdate: "agent_message_chunk"; … })
  | (… & { sessionUpdate: "agent_thought_chunk"; … })
  | (… & { sessionUpdate: "tool_call"; … })
  | (… & { sessionUpdate: "tool_call_update"; … })
  | (… & { sessionUpdate: "current_mode_update"; … })
  | (… & { sessionUpdate: "config_option_update"; … });
export type McpServer =
  | (McpServerHttp & { … }) | (McpServerSse & { … }) | (McpServerAcp & { … }) | McpServerStdio;
```

---

## 19. Appendix B — mapping to the existing findings ledger

| Finding | Status | How this research relates |
| --- | --- | --- |
| F-021 "Invoke IDE tools end to end" | Open | This is the deterministic close |
| F-030 "Persist IDE inspection evidence" | Open | The report file closes it |
| F-033 "Require fresh-chat release acceptance" | Open | Enforcement removes the manual fresh-chat dependency for the inspection item |
| F-006 "Dogfood non-empty MCP descriptors" | Resolved (fixture smoke) | Unchanged |
| F-007 "Expose loaded build identity" | Open | Unchanged; enforcement needs a fresh bundle to exist |
| F-008 "Require fresh process after rebuild" | Open | Unchanged; enforcement lives in the fresh process |
| F-023 "Clarify tools/list_changed" | Open | Unchanged; enforcement must tolerate stale/immutable catalogs |
| F-028 "Test bridge-log redaction" | Open | Unchanged; enforcement reports reuse the same redaction |

---

## 20. Appendix C — file inventory and key sources

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
.pi/skills/packs.json
.pi/fabric.json
```

---

## 21. Glossary

| Term | Definition |
| --- | --- |
| ACP | Agent Client Protocol — JSON-RPC 2.0 over stdio between a code editor and an AI coding agent |
| MCP | Model Context Protocol — tool/server protocol; the IDE exposes its engine as an MCP server |
| Bridge | the adapter's `AcpMcpBridge`: connects to the IDE MCP server, discovers the catalog, exposes tools to pi |
| Catalog | the session-immutable list of IDE MCP tools (30 in the live session) |
| SSE | Server-Sent Events — the transport IntelliJ's private MCP server uses (in-process endpoint) |
| IPC | the adapter↔pi extension socket (single-client, token-authenticated) |
| Turn | one `session/prompt` round trip (model processes one prompt and returns `end_turn`) |
| Enforcement | a deterministic, model-independent trigger — as opposed to an advisory skill |
| Gate | the check + report + policy attached to a trigger |
| F-xxx | finding IDs from `docs/findings/2026-08-14-jetbrains-acp-dogfood-findings.md` |

---

## 22. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-08-14 | Initial deep-research document (this study) |
| 2 | 2026-08-14 | Expanded to 700+ lines per review; added worked example, risk table, rollout plan, evidence appendix |

---

## One-line conclusion

> Adapter-enforced IDE inspection is a deterministic, per-turn quality gate implemented at the only layer with the authority to run it (authenticated IDE connection + turn boundary). It reuses the IDE's own inspection engine and the existing MCP surface, adds no protocol, no linter, and no runtime fork — so it is **not** reinventing anything; it is finally *closing* what F-021/F-030/F-033 already identified as missing.

---

## 23. Alternative trigger points

The post-turn (`end_turn`) hook is the recommended default, but it is not the only possible trigger. Each has a different cost/coverage trade-off:

| Trigger | Coverage | Cost | Noise | Verdict |
| --- | --- | --- | --- | --- |
| Post-edit (per tool write) | immediate, per file | high (many calls) | high | rejected — too chatty |
| Post-turn (`end_turn`) | per prompt response | medium | medium | **recommended** |
| On-demand (slash command) | user-invoked | low | low | useful addition |
| Session close | final sweep | low | low | phase-2 candidate |
| Periodic (time-based) | drift detection | medium | medium | rejected — arbitrary |

The post-turn trigger is the right default because it aligns exactly with "the agent produced a unit of work" — the moment the user is waiting for.

---

## 24. Security considerations

1. **Token handling:** the enforcement reuses the bridge's existing SSE connection; it never reads or persists `IJ_MCP_AUTH_TOKEN`. The report contains only inspection results and file paths, never descriptor secrets.
2. **Redaction:** all report content passes through the repo's existing redaction helpers (the same deny-by-default sanitizer used for bridge descriptors), so secret-shaped strings are scrubbed before the report is written.
3. **Path disclosure:** reports live under `<cwd>/.pi/work/ide-inspections/`, already the repo's work-record convention; file paths are project-relative.
4. **IPC:** enforcement runs in-process on the adapter; it does not open new sockets or widen the existing single-client IPC surface.
5. **Failure mode:** if anything throws (git missing, tool error, timeout), the turn is unaffected — the error is caught, a diagnostic is emitted, and `end_turn` is returned as usual.
6. **No new network surface:** enforcement only talks to the already-authorized IDE endpoint through the already-open connection.

---

## 25. Performance and latency budget

- `git status --porcelain`: ~10–50 ms on a normal repo.
- `lint_files` over ≤200 changed files: typically 0.5–3 s against the IDE.
- Total added latency per turn: ~1–3 s worst case, well under the existing per-request deadlines (discovery 10 s, runtime 120 s).
- Bound the budget: `PI_ACP_IDE_INSPECT_TIMEOUT_MS=30000` (default) caps the whole inspection; the hook never blocks cancel.
- If latency matters more than coverage, the flag can be set to `0` or the file cap reduced.

---

## 26. Decision log

| Decision | Choice | Rationale |
| --- | --- | --- |
| Where enforcement lives | adapter (`src/acp/`) | only layer with the IDE connection + turn boundary |
| Trigger | post-`end_turn` | exactly the "unit of work" boundary |
| Check | `lint_files` (batched) + optional `get_file_problems` | reuses the IDE engine; single call per turn |
| Default | ON | the user's explicit requirement ("enforce") |
| Opt-out | `PI_ACP_ENFORCE_IDE_INSPECT=0` | escape hatch / rollout safety |
| Delivery | persisted report + `session/update` + `_meta` | durable + visible |
| Fork? | no | zero runtime changes |
| Skill? | supplementary only | skills are advisory by design |

---

## 27. Non-goals

- Making the IDE run inspections it does not already run (that is IntelliJ's own feature set).
- Blocking turns on inspection failures (the gate records and surfaces; it does not veto).
- Replacing CI (eslint/tsc/prettier stay as merge-time gates).
- Implementing a diagnostics channel in ACP (out of our control, not needed).
- Enforcing in non-ACP contexts (plain pi sessions without a host bridge remain unenforced by design).

---

## 28. Follow-up work (tracked separately)

- Phase 2: `session/close` final sweep; configurable file patterns; report pruning.
- Phase 3: inject ERROR findings into the next prompt (strong enforcement).
- Optional: per-repo policy via `PI_ACP_ENFORCE_IDE_INSPECT` in repo-local config.
- Optional: surface inspection summary in the host UI (requires IntelliJ-side support; out of scope here).

---

_End of research document._

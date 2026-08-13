# pi-acp-jetbrain (ACP adapter for pi-coding-agent)

This repository implements an **Agent Client Protocol (ACP)** adapter for **pi** (`@earendil-works/pi-coding-agent`) without modifying pi.

- ACP side: **JSON-RPC 2.0 over stdio** using `@agentclientprotocol/sdk` (TypeScript)
- Pi side: spawn `pi --mode rpc` and communicate via **newline-delimited JSON** over stdio

## Architecture (MVP)

### 1 ACP session ↔ 1 pi subprocess

Pi RPC mode is effectively single-session, so the adapter maps:

- `session/new` → spawn a dedicated `pi --mode rpc` process
- `session/prompt` → send `{type:"prompt"}` to that process and stream events back as `session/update`
- `session/cancel` → send `{type:"abort"}`

### ACP server wiring (modeled after opencode)

Use `@agentclientprotocol/sdk`:

- `ndJsonStream(input, output)` to speak ACP over stdio
- `new AgentSideConnection((conn) => new PiAcpAgent(conn, config), stream)`

## Implementation constraints / decisions

## IntelliJ MCP bridge

The installed IntelliJ ACP implementation supplies its private IDE MCP server as `McpServer.Stdio` with `command` (`idea.sh`), `args` (`stdioMcpServer`), and `env` (including `IJ_MCP_SERVER_PORT`); this is the primary IntelliJ path. The IntelliJ launcher script forwards the command to the already-running IDE and exits 0 without speaking MCP, so the bridge prefers a direct MCP-over-SSE client against `http://127.0.0.1:<IJ_MCP_SERVER_PORT>/sse` when the port is present (healthy sessions never spawn the launcher) and falls back to the stdio child only when the endpoint is unreachable. `McpServerAcp` and `mcp/connect`/`mcp/message` remain supported for hosts using the draft ACP MCP transport.

The bridge launches stdio MCP servers from the session working directory, discovers a bounded cursor-paginated catalog, and exposes deterministic `ide_<server>_<tool>` extension tools over authenticated per-session IPC. The catalog is immutable for the session; changing IntelliJ MCP settings or the allowlist requires a new ACP chat. Runtime calls have a separate deadline from discovery. Stdio cancellation uses the actual MCP request ID; ACP cancellation is best-effort when the outer SDK does not expose the inner request ID. Pi registration is acknowledged per tool and validated against catalog names/schema hashes; partial registration remains diagnostic. Server-originated `tools/list_changed` is a session-snapshot diagnostic, while unsupported server requests are rejected rather than silently ignored.

Do not silently use IntelliJ AllowAll. The installed IntelliJ source shows omitted `idea_mcp_allowed_tools` means AllowAll, while an explicit list becomes deny-all plus explicit names. Keep terminal, database, universal execution, debugger launch/control, breakpoint mutation, and variable mutation outside the default profile unless deliberately reviewed.

- Do **not** implement ACP client-side FS/terminal delegation in MVP. Pi already reads/writes and executes locally.
- Accept and bridge supported `mcpServers` descriptors through the session-owned IntelliJ/MCP adapter; preserve graceful degradation for unavailable servers.
- Stream all pi assistant output as ACP `agent_message_chunk` initially.
- Tool events: map pi tool execution events to ACP `tool_call` / `tool_call_update` (as text content).

## Dev workflow (to be filled once scaffold exists)

- Install deps: `npm install`
- Run in dev: `npm run dev`
- Build: `npm run build`
- Smoke test (stdio): `npm run smoke`
- Lint: `npm run lint`
- Test: `npm run test`

## Manual testing notes

Once the adapter runs, it should behave like an ACP agent on stdio.

Quick sanity test (example):

```bashN
# Send initialize request via stdin (exact fields depend on ACP SDK version)
# echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}' | node dist/index.js
```

For real validation, test with JetBrains IntelliJ (the primary ACP host) or a headless ACP client such as `scripts/smoke-*.mjs`.

## Coding guidelines

- Keep ACP protocol handling in `src/acp/*`.
- Keep pi RPC subprocess logic in `src/pi-rpc/*`.
- Prefer small translation functions (pi event → ACP session/update) with unit tests.
- Be strict about streaming and process cleanup (handle exit, drain stdout/stderr, timeouts).
- Avoid producing unnecessary comments! Use comments sparingly to explain non-obvious decisions, not to narrate code.
- Avoid using `any` in TypeScript; prefer explicit types and interfaces. Only use `any` when absolutely necessary (e.g. for untyped external data).

## Validation

- After making code edits, run formatting before finishing the task. Use `npm run format` when it is safe to format the whole worktree; otherwise use the narrowest safe formatter command for the files you touched.
- If formatting is skipped or fails, say so explicitly in the final response.
- When the JetBrains IDE MCP catalog is exposed, run IDE inspections (`lint_files` / `get_file_problems`) on changed source and report findings; say so explicitly when IDE tools are unavailable.
- An independent reviewer must review the final diff and report no unresolved P0/P1 findings before completion.

## Operating rules

- Run the Schema loop inside one `fabric_exec` before any mutation: `schema.hypothesize` with evidence, `schema.verify`, then `schema.commit` with declared operations and nonempty postconditions.
- Evidence is data, not prose: `file_contains`, `file_sha256`, or the trusted `canonical-check` command (`node scripts/check.mjs`).
- Track progress in the work ledger, marking completed steps `[DONE:n]`.
- If Schema enforce is not active, get explicit user approval for the exact files and consequences before mutation.

## Source control

- After successful verification of a mutating request, create an atomic, path-scoped commit automatically. Use a detailed message describing intent, important implementation details, and verification performed. Never push unless explicitly requested.
- The user-installed `scripts/auto-commit.mjs` watcher is the sole exception to path-scoped staging: it may commit all non-ignored tracked and untracked repository changes after its safety scan.

## Client information

- Current ACP client is JetBrains IntelliJ (dogfooded through `~/.jetbrains/acp.json` → `pi-acp-jetbrain`)

## References

- Local ACP repo with protocol documentation and specs: `~/Dev/learning/agent-client-protocol`
- IntelliJ ACP config: `~/.jetbrains/acp.json`; adapter stderr lands in `~/.cache/JetBrains/IntelliJIdea*/log/idea.log`

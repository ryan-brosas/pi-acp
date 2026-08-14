# pi-acp-jetbrain

ACP ([Agent Client Protocol](https://agentclientprotocol.com/overview/introduction)) adapter for [`pi`](https://github.com/earendil-works/pi) coding agent (fka shitty coding agent).

`pi-acp-jetbrain` communicates **ACP JSON-RPC 2.0 over stdio** to an ACP client (primarily JetBrains IntelliJ) and spawns `pi --mode rpc`, bridging requests/events between the two.

## Status

This is an MVP-style adapter intended to be useful today and easy to iterate on. Some ACP features may be not implemented or are not supported (see [Limitations](#limitations)). Development is centered around JetBrains IntelliJ support (the adapter's primary ACP host); other ACP clients may have varying levels of compatibility.

Expect some minor breaking changes.

The local IntelliJ integration is experimental: IntelliJ's installed ACP implementation supplies its private IDE MCP server as a stdio descriptor (`idea.sh`), and `pi-acp-jetbrain` bridges it into Pi as `ide_<server>_<tool>` tools. The IntelliJ launcher script forwards the stdio command to the already-running IDE and exits 0 without speaking MCP, so `pi-acp-jetbrain` prefers a direct connection to the IDE's in-process SSE endpoint when the descriptor carries `IJ_MCP_SERVER_PORT`, and falls back to the stdio child only if that endpoint is unreachable. The draft ACP MCP transport remains supported for other hosts. The IntelliJ path is verified end to end: a live IntelliJ host registered all discovered IDE tools with pi, pi invoked `ide_idea_get_file_problems` through the bridge and received the IDE's inspection result, and session teardown left no orphan processes.

## Features

- Streams assistant output as ACP `agent_message_chunk`
- Maps pi tool execution to ACP `tool_call` / `tool_call_update`
  - Tool call locations are surfaced when available for ACP clients that support opening the referenced file/context
  - Relative file paths from pi are resolved against the session cwd before being emitted as ACP tool locations, which enables follow-along features in clients like IntelliJ
  - For `edit`, `pi-acp-jetbrain` attempts to infer a 1-based line number from a unique `oldText` match in the pre-edit file snapshot and includes it in the emitted tool location when possible
  - For `edit`, `pi-acp-jetbrain` snapshots the file before the tool runs and emits an ACP **structured diff** (`oldText`/`newText`) on completion when possible
- Session persistence
  - pi stores its own sessions in `~/.pi/agent/sessions/...`
  - `pi-acp-jetbrain` stores a small mapping file at `~/.pi/pi-acp/session-map.json` so `session/load` can reattach to a previous pi session file
- Slash commands
  - Loads file-based slash commands compatible with pi’s conventions
  - Adds a small set of built-in commands for headless/editor usage
  - Supports skill commands (if enabled in pi settings, they appear as `/skill:skill-name` in the ACP client)
- Skills are loaded by pi directly and are available in ACP sessions
- `pi-acp-jetbrain` emits a “startup info” block into the session (pi version, context, skills, prompts, extensions, and IDE bridge status - similar to `pi` in the terminal). You can disable it by setting `quietStartup: true` in pi settings (`~/.pi/agent/settings.json` or `<project>/.pi/settings.json`). When `quietStartup` is enabled, `pi-acp-jetbrain` will still emit a 'New version available' message if the installed pi version is outdated.
- Session history: `session/load` maps to pi's session files, so sessions can be resumed both in `pi` and in the ACP client.

## Operating layer

The repository ships an operating layer for pi: **9 prompt commands**, **100 skill files** (90 leaves in 10 packs), and **12 format templates**.

## Prerequisites

Make sure pi is installed

```bash
npm install -g @earendil-works/pi-coding-agent
```

- Node.js 20+ (the CI matrix runs Node 20 and 24)
- `pi` v0.80.4+ installed and available on your `PATH` (the adapter runs the `pi` executable)
- Configure `pi` separately for your model providers/API keys

## Install

### Add pi-acp-jetbrain to JetBrains IntelliJ

IntelliJ ships an ACP host; register `pi-acp-jetbrain` as an agent server in IntelliJ's ACP settings (`~/.jetbrains/acp.json`). This is the configuration used for day-to-day development:

```json
{
  "agent_servers": {
    "pi-acp-jetbrain": {
      "command": "/path/to/pi-acp-jetbrain/dist/index.js",
      "args": [],
      "env": {
        "PI_ACP_PI_COMMAND": "/path/to/pi",
        "PI_ACP_DEBUG_BRIDGE": "1"
      },
      "idea_mcp_allowed_tools": [
        "search_symbol",
        "get_symbol_info",
        "analyze_calls",
        "search_text",
        "search_regex",
        "get_file_problems",
        "lint_files",
        "build_project",
        "execute_run_configuration",
        "git_status",
        "get_repositories",
        "get_project_modules",
        "get_project_dependencies",
        "list_directory_tree",
        "read_file",
        "search_file",
        "open_file_in_editor",
        "get_all_open_file_paths",
        "skill_search"
      ]
    }
  }
}
```

`idea_mcp_allowed_tools` is a deny-all mask plus the named tools (see [Limitations](#limitations)); the profile above is the recommended read/build safe default — add only the tools you need. Omitting the key means the IDE allows everything (AllowAll), which is a deliberate security decision.

IntelliJ passes its private IDE MCP server per chat; the bridge exposes the IDE's semantic tools to pi as `ide_<server>_<tool>` extension tools (see [Limitations](#limitations)). The same bridge is designed for any JetBrains IDE that ships ACP plus the integrated MCP server (IntelliJ IDEA, WebStorm, PyCharm, GoLand, PhpStorm, RubyMine, RustRover, Rider, CLion, DataGrip, DataSpell); per JetBrains documentation ACP and the integrated MCP server are available across these products. Tools are discovered dynamically, so product-specific capabilities surface per IDE and every tool stays optional.

### Package installation for IntelliJ

#### Using `npx`

Pin the version (`npx -y pi-acp-jetbrain@<version>`) so a future start cannot silently fetch a different release.

```json
{
  "agent_servers": {
    "pi-acp-jetbrain": {
      "command": "npx",
      "args": ["-y", "pi-acp-jetbrain"],
      "env": {}
    }
  }
}
```

#### Global install

The npm package is `pi-acp-jetbrain`; the installed executable remains `pi-acp` for compatibility.

```bash
npm install -g pi-acp-jetbrain
```

```json
{
  "agent_servers": {
    "pi-acp-jetbrain": {
      "command": "pi-acp",
      "args": [],
      "env": {}
    }
  }
}
```

#### From source

```bash
npm install
npm run build
```

Point IntelliJ to the built `dist/index.js`:

```json
{
  "agent_servers": {
    "pi-acp-jetbrain": {
      "command": "node",
      "args": ["/path/to/pi-acp-jetbrain/dist/index.js"],
      "env": {}
    }
  }
}
```

### Environment variables

- `PI_ACP_ENABLE_EMBEDDED_CONTEXT=true` advertises ACP `promptCapabilities.embeddedContext` support to the client.
- `PI_ACP_DEBUG_BRIDGE=1` logs the sanitized `session/new.mcpServers` descriptor to stderr on every new session. IntelliJ pipes the adapter's stderr into `idea.log`, so this captures the exact descriptor the host sent (values redacted except `IJ_MCP_SERVER_PORT`/`IJ_MCP_SESSION_ID`).
- `PI_ACP_SESSION_MAP=<path>` overrides where the adapter persists its session map (default `~/.pi/pi-acp/session-map.json`); the smoke matrix uses a per-run temporary path so dogfood never touches the real store (F-027).
- Default: unset/any other value means `false`.
- When disabled, compliant ACP clients should avoid sending embedded `resource` blocks. If they send them anyway, `pi-acp-jetbrain` still degrades gracefully by converting them into plain-text prompt context.

Add environment variables to the IntelliJ agent entry in `~/.jetbrains/acp.json`:

```json
{
  "agent_servers": {
    "pi-acp-jetbrain": {
      "command": "node",
      "args": ["/path/to/pi-acp-jetbrain/dist/index.js"],
      "env": {
        "PI_ACP_ENABLE_EMBEDDED_CONTEXT": "true"
      }
    }
  }
}
```

### Slash commands

`pi-acp-jetbrain` supports slash commands:

#### 1) File-based commands (aka prompts)

Loaded from:

- User commands: `~/.pi/agent/prompts/**/*.md`
- Project commands: `<cwd>/.pi/prompts/**/*.md`

#### 2) Built-in commands

- `/compact [instructions...]` – run pi compaction (optionally with custom instructions)
- `/autocompact on|off|toggle` – toggle automatic compaction
- `/export` – export the current session to HTML in the session `cwd`
- `/session` – show session stats (tokens/messages/cost/session file)
- `/name <name>` – set session display name
- `/queue all|one-at-a-time` – set pi queue mode (unstable feature)
- `/changelog` – print the installed pi changelog (best-effort)
- `/steering` - maps to `pi` Steering Mode, get/set
- `/follow-up` - pats to `pi` Follow-up Mode, get/set

Other built-in commands:

- `/model` - not implemented (use the model selector UI in the ACP client)
- `/thinking` - maps to the client's model 'mode' selector
- `/clear` - not implemented (use ACP client 'new' command)

#### 3) Skill commands

- Skill commands can be enabled in pi settings and will appear in the slash command list in ACP client as `/skill:skill-name`.

**Note**: Slash commands provided by pi extensions are not currently supported.

## Authentication

The adapter advertises **Terminal Auth** metadata. IntelliJ can launch the compatible `pi-acp --terminal-login` command for interactive provider login/setup:

```bash
pi-acp --terminal-login
```

Your ACP client can also invoke this automatically based on the agent's advertised `authMethods`.

## Development

```bash
npm install
npm run dev        # run from src via tsx
npm run build
npm run lint
npm run test
```

Project layout:

- `src/acp/*` – ACP server + translation layer
- `src/pi-rpc/*` – pi subprocess wrapper (RPC protocol)

## Limitations

- No ACP filesystem delegation (`fs/*`) and no ACP terminal delegation (`terminal/*`). pi reads/writes and executes locally.
- MCP servers are accepted in ACP params and bridged into the Pi subprocess as deterministic `ide_<server>_<tool>` extension tools.
  - IntelliJ's primary path is stdio MCP (`command`, `args`, `env`); draft ACP MCP remains supported.
  - IntelliJ's launcher-based stdio descriptor forwards to the running IDE and exits 0. When the descriptor carries `IJ_MCP_SERVER_PORT`, the bridge prefers a direct MCP-over-SSE client (`/sse` + `/message`) against the IDE's in-process server (so healthy sessions never spawn the launcher) and falls back to the stdio child only when that endpoint is unreachable — the same bounded discovery, runtime deadlines, cancellation, and diagnostics apply to both transports.
  - Discovery is bounded, cursor-paginated, deduplicated, and immutable for the session.
  - IntelliJ tools receive the ACP working directory as `projectPath` automatically when their schema declares it; explicit model arguments win.
  - New sessions include semantic-first IDE guidance (symbol search/info, call hierarchy, inspections, refactoring, build/run, Git, and controlled debugger workflows) so Pi uses IntelliJ's index instead of approximating everything with shell/text tools.
  - Runtime calls use a separate long timeout from discovery and support cancellation/late-response suppression.
  - JSON Schema conversion preserves required fields, nested structures, enums, const, unions/intersections, tuple items, local `$ref`/`$defs`/`definitions`, and common constraints with bounded permissive fallback.
  - MCP text/images/resources and structured content map into Pi content/details; `isError` becomes a failed Pi tool.
  - Private IPC validates catalog identity, tool names, and schema hashes in per-tool registration acknowledgements and reports partial registration health.
  - Server-originated ACP MCP notifications are diagnosed; `tools/list_changed` requires a new session and unsupported server requests are rejected.
- The IntelliJ allowlist is controlled by `~/.jetbrains/acp.json`. The current 40-tool profile includes controlled debugger start/control/breakpoint workflows while excluding terminal, database, universal execution, arbitrary debugger expression evaluation, and variable mutation. An explicit `idea_mcp_allowed_tools` list is a deny-all mask plus named tools; omitting it means AllowAll in the installed build and should be treated as a deliberate security/context decision.
- The bridge uses an immutable per-session catalog. After changing IntelliJ MCP settings or the allowlist, start a new ACP chat.
- Debugger tools (`xdebug_*`) are conditional: they register only while an IDE debug session is live; the registered catalog is otherwise stable for the chat. If debugger tools are absent from a fresh chat's tool list, start a debug session and begin a new chat (F-022).
- After rebuilding the adapter, start a new chat: Node does not reload replaced files and IntelliJ reuses running agent processes. Verify the loaded bundle via `initialize.agentInfo._meta.piAcp.build` revision on a fresh PID (F-008).
- The smoke matrix bounds the startup prelude (`startupInfo` ≤ 32 KB) and the `session/new` payload (≤ 64 KB) and prints measured sizes each run (F-010).

- Assistant streaming is sent as `agent_message_chunk`; model reasoning arrives as `agent_thought_chunk` when the provider emits it.
- Queue is implemented client-side and should work like pi's `one-at-a-time`
- ~~ACP clients don't yet suport session history, but ACP sessions from `pi-acp-jetbrain` can be `/resume`d in pi directly~~

### IDE log noise

Known benign patterns in the IDE log do not indicate an adapter fault (F-029):

- `Agent not installed` can appear for a healthy local command agent; the adapter launches `pi` directly and does not require a JetBrains Marketplace plugin.
- `tools/list_changed` diagnostics: the catalog is a per-session snapshot; the IDE re-advertising tools does not change the current chat's catalog. Start a new chat to refresh.

Actionable patterns: any `IDE bridge: ... unavailable` diagnostic means discovery or a spawn failed and the chat has a partial catalog — check `idea.log` for the reason and start a new chat after fixing the cause.

## License

MIT (see [LICENSE](LICENSE)).

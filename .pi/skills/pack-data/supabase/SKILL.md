---
name: supabase
description: Use when working with any Supabase service — database operations, edge functions, auth, storage, or project management. MUST load before writing Supabase queries, RLS policies, or edge functions.
disable-model-invocation: true
---


# Supabase Platform (MCP)

## When to Use

- When you need to manage Supabase projects, databases, or edge functions via MCP.

## When NOT to Use

- When the backend is not Supabase or MCP access is unavailable.


## Available Tools

### Account & Projects

- `list_projects` - Lists all Supabase projects
- `get_project` - Gets details for a specific project
- `list_organizations` - Lists all organizations

### Database

- `list_tables` - Lists all tables in specified schemas
- `list_extensions` - Lists PostgreSQL extensions
- `list_migrations` - Lists database migrations
- `execute_sql` - Executes raw SQL queries

### Development

- `get_project_url` - Gets the API URL for a project
- `get_publishable_keys` - Gets anonymous API keys (client-safe)
- `generate_typescript_types` - Generates TypeScript types from schema

### Edge Functions

- `list_edge_functions` - Lists all Edge Functions
- `get_edge_function` - Retrieves Edge Function file contents
- `deploy_edge_function` - Deploys or updates an Edge Function

### Debugging

- `get_logs` - Retrieves logs by service type
- `get_advisors` - Gets security/performance advisory notices

### Documentation

- `search_docs` - Searches Supabase documentation

## Workflow

### Invocation

Invoke tools through the configured MCP bridge as `mcp.<server>.<tool>`. Discover the real server/tool names and schemas first (`tools.search({ query: "supabase" })` then `tools.describe` on the matched ref) — never assume names. Tool names below are the Supabase MCP server's canonical names.

Read-only examples: `list_projects`, `list_tables`, `generate_typescript_types`, `search_docs`, `get_project_url`, `get_publishable_keys`, `get_logs`, `get_advisors`, `list_edge_functions`, `get_edge_function`.

**`execute_sql` and `deploy_edge_function` are write-capable**: require the Schema loop (or explicit user approval) before invoking them; default to read-only queries.

### Debug Issues

Read-only examples: `get_logs`, `get_advisors`.

Deploying an Edge Function (`deploy_edge_function`) is a production mutation — Schema commit (or explicit user approval) required.



## Security Notes

- **Read-only mode**: Set `"read_only": true` in mcp.json to disable write operations
- **Project scoping**: Use `project_ref` to limit access to specific projects
- **Environment variables**: Set `SUPABASE_ACCESS_TOKEN` for authentication

## Server Options

For advanced usage, modify `mcp.json`:

```json
{
  "supabase": {
    "command": "npx",
    "args": ["-y", "@supabase/mcp@<pinned-version>"],  # pin the version; verify the tool surface matches this skill
    "env": {
      "SUPABASE_ACCESS_TOKEN": "your-token-here"
    },
    "includeTools": ["list_tables", "execute_sql", "..."]
  }
}
```

Configuration options:

- `project_ref` - Scope to specific project (recommended)
- `read_only` - Restrict to read-only operations (recommended)
- `features` - Enable specific tool groups

> **Note**: This skill loads 14 essential tools. Excludes experimental (branching) and storage tools that require paid plans.

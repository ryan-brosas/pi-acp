---
name: elixir-development
description: "Use when writing or reviewing Elixir - OTP, supervision trees, GenServers, Ecto, and Phoenix LiveView."
disable-model-invocation: true
---

# Elixir Development

## Use when

Writing or reviewing Elixir apps, Phoenix services, or OTP components.

## Do not use when

Simple CRUD without concurrency needs; `python-development` or `go-development` may fit.

## Key rules

- Processes are the isolation unit; one process per responsibility, supervised.
- Supervision trees define restart strategy; let it crash and restart.
- GenServer for stateful components; never use global mutable state.
- Ecto for persistence; schemas and query composition, no string interpolation.
- Phoenix LiveView for real-time UI; keep the socket light.
- ExUnit for tests; property-based testing with StreamData where valuable.
- mix for tasks and releases; keep the toolchain current.
- Backpressure: bounded queues or processes; never unbounded mailboxes.

## Red flags

Global state; un-supervised processes; blocking calls in a GenServer; Ecto string queries; unbounded mailboxes.

## Skill Result Contract

```xml
<skill_result>
  <skill>elixir-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Supervision tree, GenServers, Ecto usage, tests</evidence>
  <artifacts>App code, schemas, test suite</artifacts>
  <risks>State leak, unbounded queues, or none</risks>
</skill_result>
```

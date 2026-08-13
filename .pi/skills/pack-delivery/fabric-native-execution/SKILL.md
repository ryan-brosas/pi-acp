---
name: fabric-native-execution
description: Use when executing Pi Fabric work that can lean on native providers (memory, state, compact) inside fabric_exec, or when a workflow needs durable session state or cross-session recall.
disable-model-invocation: true
---

# Fabric-Native Execution

Prefer Pi Fabric's native providers over hand-rolled files and shell caches. The Schema loop stays the mutation gate; these providers are read/write helpers around it, never a replacement for `schema.hypothesize → verify → commit` on repo files.

## Providers

- `memory.recall` / `memory.expand` — search past sessions and durable decisions for evidence before re-deriving them. Use for cross-session recall ("what did we decide about X").
- `state.get` / `state.put` / `state.list` — versioned shared state keyed by prefix. Highly valuable for short-lived coordination values (active work ID, current station, handoff payloads between `/ship` stations, verification cache). Use this to survive across `fabric_exec` calls without repeatedly touching repo dotfiles.
- `compact.request` — ask the host to compact context at a safe boundary (used by `/ship` between stations). Keep the handoff payload in `state` or the station ledger, not only in memory.

## Rules

- Evidence over prose: cite the provider result (value, recall hit, event) when you rely on it.
- Never write repo files through `state`; it is runtime state, not the durable record. The work ledger (`.pi/work/<slug>/.progress.md`) stays authoritative for history.
- Do not use `mesh` (multi-actor coordination is overkill for a local template) and do not dispatch subagents (`agents.run`).
- If a provider is missing or refused, degrade to reading the tracked files and say so.
- Do not build a persistence layer: one `put` for a value, one `recall` for a decision, one `compact.request` per station boundary.

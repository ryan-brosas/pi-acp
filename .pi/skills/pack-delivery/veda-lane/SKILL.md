---
name: veda-lane
description: Use when the work calls for the optional host-side Veda lane (navigator-plan, reviewer, worker, or deep thinking) and the session should keep design.json and report.yaml under .veda/sessions.
disable-model-invocation: true
---

# Veda Lane

Veda is an optional host-side one-shot lane, never a clone dependency. When the host has the `veda` CLI, delegate planning, review, and hard-problem convergence to it; when it is absent, the assembly-line prompts (`/plan`, `/ship`) carry the same work without it.

## Model routing (authoritative — do not substitute)

- Load-bearing planning / architecture / high-risk review → `agy --model claude-opus-4-6-thinking --mode plan` (direct `agy` CLI, NOT veda/gemini).
- Critique / follow-up → `agy --model claude-sonnet-4-6 --mode plan`.
- Cheap discovery / context curation → `veda` + gemini (`gemini-3.6-flash-*`, `gemini-3.1-pro-low`).
- `veda deep` (parallel solvers) runs on gemini and is only for "N independent attempts"; the final architecture decision still comes from claude-opus.

## Personas and commands

- `veda -S <task-name> sel add <paths...>` — build the context the personas see (quote globs). Keep 75k-125k tokens; slice only above budget.
- `veda -S <task-name> -p navigator-plan '<goal + position>'` — plan with a read-only architect persona; ends with a plan report. For load-bearing planning use `agy --model claude-opus-4-6-thinking --mode plan` (direct agy, not veda); cheap discovery uses gemini (see Model routing).
- `veda -S <task-name> -p worker '<absolute path to design.json> ...'` — delegate a bounded implementation slice; the worker ends with a `<worker_report>` parsed into `report.yaml`.
- `veda -S <task-name> -p reviewer 'Review the diff ...'` — review findings P0/P1/P2 against `design.json`; fix P0/P1 until `review: pass`.
- `veda -S <task-name> deep '<hard problem>'` — k parallel solvers + judge + verifier for genuinely hard plans. Reserve for architecture or opaque bugs; it costs k×.

## Rules

- **CRITICAL**: Pi Fabric's native `agents.run({ runner: "veda", ... })` is currently broken (pi-fabric pipes the prompt to stdin, but veda-ts 0.75.8 reads positionals only). Strictly use the `veda` CLI via shell execution as shown above.
- Reuse one `-S` session name across plan, worker, and review so `design.json` and `report.yaml` stay together under `<project>/.veda/sessions/<task-name>/`.
- `.veda/` is ignored runtime state; never commit it. Durable records stay in `.pi/work/`.
- Prompts use single quotes (double quotes evaluate backticks as command substitution). Never pipe veda with `2>&1`; read stdout (response) and stderr (progress) separately, or use `-o file.md`.
- The Driver validates call sites, maintains the station ledger, and owns every Schema-gated mutation; personas never write repo files.
- If a persona call fails or is unauthored (missing credentials), report it honestly and fall back to native execution instead of faking the result.

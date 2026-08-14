---
description: Run garbage collection — structural scan and non-destructive cleanup plan
argument-hint: "[area]"
---

# Garbage Collection

Run a structural scan of the project, report dead weight, and propose scoped cleanup.

## Load Skills

Load the skill at `.pi/skills/verification-before-completion/SKILL.md`.

## Phase 1: Structural Scan (read-only)

Scan the project for dead weight:
- **Dead references**: skills/templates/prompts mentioned nowhere (grep each `.pi/skills/*/SKILL.md` name against prompts, README, AGENTS.md).
- **Stale instructions**: AGENTS.md or docs claiming behaviors that no longer exist (removed commands, removed tools).
- **Unused assets**: template files never referenced by any prompt.
- **Generated state**: `.pi/MEMORY.md`, `.pi/implementation-notes.md`, `.pi/work/.active`, per-work `.progress.md`/`.verify.log`, `.pi/fabric/` contents that can be regenerated.
- **Redundant rules**: duplicated instructions across AGENTS.md, skills, and prompts that say the same thing differently.

Use bounded `rg -n` and `find` for each scan. Report counts, not raw dumps.

## Phase 2: Grade Each Domain

Grade the retained domains as findings (this template has no committed quality ledger):

| Domain | Source | Grade |
| --- | --- | --- |
| Prompts | `.pi/prompts/*.md` | A-D |
| Skills | `.pi/skills/` | A-D |
| Templates | `.pi/templates/` | A-D |
| Root docs | `AGENTS.md`, `README.md` | A-D |

Report grades in the completion output.

## Phase 3: Cleanup Plan (non-destructive)

For each P0/P1 finding, propose a concrete cleanup item: the file, the change, and the verification. Do not edit anything in this command. Cleanup happens only through a later Schema commit.

## Phase 4: Report (output contract)

Output:

1. **Grades:** per-domain status with the evidence behind each grade
2. **Dead weight:** count by category, with the offending paths
3. **Cleanup plan:** scoped items, ready for the Schema loop
4. **Recommendations:** improvements for the next cycle

## Schema boundary

This command is read-only analysis. Before any deletion or refactor, run the
Schema loop inside one `fabric_exec` — `schema.hypothesize` (evidence:
`file_contains`/`file_sha256` literals or the `canonical-check` trusted
command) → `schema.verify` → `schema.commit` with declared operations and
nonempty postconditions. If verification fails, do not mutate. **Dual mode:**
read-only analysis is identical in both modes; cleanup branches by mode —
Schema mode (`schema.status().mode === "enforce"`) runs the loop above,
main-session mode (guard off or project untrusted) proposes each exact
deletion or refactor for explicit user approval. Detect at the mutation
boundary: `schema.status()` reports `enforce` → Schema mode; otherwise →
main-session mode.

## Related Commands

| Need | Command |
| --- | --- |
| Full verification | `/verify all --full` |
| Architecture audit | `/audit` |

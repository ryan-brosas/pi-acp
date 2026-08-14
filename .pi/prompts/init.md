---
description: One-time full project initialization — AGENTS.md, .pi/project.md, .pi/tech-stack.md, planning context, and .pi/user.md
argument-hint: '[--deep] [--context|--user|--all]'
---

# Init: $ARGUMENTS

Initialize project setup. Run once per project.

Plain `/init` runs the complete initialization: full deep discovery, then every
context artifact — AGENTS.md, .pi/project.md, .pi/tech-stack.md, .pi/roadmap.md, .pi/state.md,
user.md. Flags only narrow or repeat parts of that one-time run.

> **Next step for fresh projects:** `/plan` to create the first implementation plan.
> **Next step for existing codebases:** `/research` for deep codebase analysis, or just start describing what you want to build.

## Idempotency Rules

| File                              | Rule                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                       | Improve in-place — never overwrite blindly                                                          |
| `.pi/project.md`                  | Create if missing; ask before overwriting an existing file (holds product and architecture context) |
| `.pi/tech-stack.md`               | Overwrite with detected values (auto-regenerated)                                                   |
| `.pi/roadmap.md` / `.pi/state.md` | Skip if exists, ask before overwrite                                                                |
| `.pi/user.md`                     | Skip if exists, ask before overwrite                                                                |

## Artifact Quality Contract

Every artifact a full `/init` writes must satisfy all of these:

1. **Minimum content per artifact.** Each artifact covers its full template section list. If a section has no verified content, write `[NEEDS CLARIFICATION: reason]` and ask the user; never silently drop a section.
2. **AGENTS.md leads with the canonical completion command and stays concise.** A full init renders repository facts, safety boundaries, repository invariants, operational traps, a compact product map, and verification evidence per the source template, with a pointer to `.pi/project.md` for the detailed architecture.
3. **Evidence citations.** Every project-specific claim, command, and restriction traces to a file:line, config entry, command output, or explicit user answer. A claim without a citation is a draft, not an artifact.
4. **Cross-file consistency.** Commands, counts, paths, and architecture terms agree across the prompt, templates, and all rendered artifacts. Detect and reconcile any disagreement before finishing.
5. **Preview material changes.** Show the user the final `AGENTS.md` (or the diff against the existing one) and the detection summary before writing; let them adjust.
6. **No invented facts.** Unknowns are marked `[NEEDS CLARIFICATION: reason]` and asked; do not guess versions, commands, branch policies, integrations, or user preferences.
7. **Verification.** After writing, run every recorded command and the repository gates, and report per-artifact results.

## Skills

Load the skill at `.pi/skills/brainstorming/SKILL.md`.
Load `.pi/skills/verification-before-completion/SKILL.md` after the artifacts are written.

## Parse Arguments

| Argument    | Default | Description                                                     |
| ----------- | ------- | --------------------------------------------------------------- |
| (none)      | —       | Full deep initialization — every artifact, run once             |
| `--deep`    | true    | Comprehensive research for every artifact (already the default) |
| `--context` | false   | Planning context only (roadmap.md, state.md) — partial rerun    |
| `--user`    | false   | User profile only (user.md) — partial rerun                     |
| `--all`     | false   | Full init — same as the default (kept for compatibility)        |

**Mode rules:**

- No flags (default): the one-time full deep init — AGENTS.md, .pi/project.md, .pi/tech-stack.md, .pi/roadmap.md, .pi/state.md, .pi/user.md.
- `--deep`: explicit deep research; the default already runs it.
- `--context`: write roadmap.md and state.md only (partial setup or rerun).
- `--user`: write user.md only (partial setup or rerun).
- `--all`: same as no flags — full init.
- GitHub setup (Phase 9) runs only in the default full init and is optional; every step can be declined, and /init works without gh.

**Brownfield auto-detection:** Existing codebase = a `src/`, `lib/`, or `app/`
directory, or standard language layouts (`.ts`, `.js`, `.tsx`, `.jsx`, `.py`,
`.go`, `.rs`, `.java`, `.cs`, `.rb`, `.php`, `.ex`, `.swift`, `.kt`,
`.dart`, `.sh`, ...). Affects discovery scope.

## Mode 1: Full Setup (Default)

### Phase 1: Deep Detect

Detect and validate, all in this one-time pass. Run independent probes through bounded read-only sub-agents when the session supports spawning them; Main synthesizes the detection table. Persist gathered answers across phases with session-persistent state (the runtime's carry mechanism when available) so later phases reuse instead of re-deriving:

- Package manager and dependencies (with versions) — read the manifest, confirm the tool exists
- Build, test, lint, dev commands — validate each actually works before writing it anywhere
- CI/CD configuration — read workflow files, extract the job list
- Existing AI rules (`.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`)
- Top-level directory structure
- Git history (last 50 commits) for patterns (commit style, common areas of change)
- Source structure and subsystem candidates (Pi Fovea sketch/focus)
- Entrypoints and composition roots (CLI, server, workers, scheduled jobs, event consumers)
- Import graph and dependency direction
- Common patterns (error handling, logging, data flow) from reading 3-5 representative files
- Data stores, schemas, and migrations
- External integrations (APIs, queues, object storage, auth providers)
- Deployment and runtime configuration (environments, health checks, rollback path)
- Testing patterns and coverage gaps (where tests live, what they cover)
- Security and trust boundaries
- Generated files and ignored state (what tools produce and must not be hand-edited)

### Phase 2: Preview Detection

Show the detected summary as a table and ask the user to confirm before writing:
**Proceed?** Write all six context artifacts with the detected configuration?
Options: Yes (write everything), Adjust (edit specific detected values first), Cancel (don't write anything).

### Phase 3: Create AGENTS.md

Load `.pi/skills/verification-before-completion/SKILL.md`.

Render `./AGENTS.md` from the source template at `.pi/templates/agents.md`:

1. Run the repository's real gates and select one canonical completion command. If no aggregate command exists, list the verified commands and mark the gap.
2. Record only repository facts, repository-specific invariants, safety boundaries for irreversible actions and secrets, and operational traps that automation cannot express.
3. Tie each command and invariant to local evidence such as a validator, workflow, manifest, config file, or command output.
4. Keep detailed architecture in `.pi/project.md`. AGENTS.md gets a compact product map and a pointer.
5. Merge verified user-authored constraints. Remove stale generated guidance only with user approval.
6. Preview material changes before writing.
7. Do not copy generic coding doctrine, research philosophy, prose rules, planning rituals, identity procedures, or architecture diagrams into AGENTS.md unless this repository has a mechanical check or explicit protocol that requires them.

The rendered file must lead with the canonical completion command. A green check defines the completion outcome; the agent retains freedom over implementation details inside the verified boundaries.

### Phase 4: Create project.md

Render `.pi/project.md` from the source template at `.pi/templates/project.md`:

- Cover: purpose and status, success criteria, target users, core principles, system context (with trust boundaries), architecture overview (with component responsibilities, composition roots, dependency rules), runtime entrypoints, request/data/event flows, configuration, data ownership, external integrations, deployment topology, testing architecture, observability, failure modes, architectural invariants, decisions, known risks, open questions, evidence.
- Every claim traces to evidence (file:line, config entry, or command output) or an explicit user answer.
- Skip a section only when there is nothing to say; mark open questions `[NEEDS CLARIFICATION: reason]`.
- If `.pi/project.md` exists, merge: preserve user-authored content, add or tighten only what the evidence supports.

### Phase 5: Create tech-stack.md

Render `.pi/tech-stack.md` from the source template at `.pi/templates/tech-stack.md` (overwrite with the fresh detection):

- Distinguish project dependencies from host tools: a host tool becomes a stack entry only when a manifest, script, workflow, or explicit user decision uses it.
- Record versions with evidence, per-command status (verified or none), CI, generated files, integrations, environments, constraints, and unknowns (`[NEEDS CLARIFICATION: reason]`).

### Phase 6: Create roadmap.md and state.md

Ask the user for project direction (vision, target users, success criteria) — reuse answers already given earlier in this run — then write `.pi/roadmap.md` and `.pi/state.md` from their source templates at `.pi/templates/roadmap.md` and `.pi/templates/state.md`. Include outcomes, dependencies, risks, and non-goals per phase in the roadmap; include verification state and working-tree context in the state file. Skip files that already exist unless the user asks to overwrite; preserve their user-authored facts when enriching.

### Phase 7: Create user.md

Ask the user (identity, communication preference, git workflow, approval boundaries), then write `.pi/user.md` from its source template at `.pi/templates/user.md`. Skip if it exists unless the user asks to overwrite; preserve its facts when enriching.

### Phase 8: Persist

Append to `.pi/MEMORY.md` (under Decisions section):

```markdown
## YYYY-MM-DD Project initialized — [tech stack summary]

Full deep init completed: AGENTS.md, .pi/project.md, .pi/tech-stack.md, .pi/roadmap.md, .pi/state.md, .pi/user.md created for [language/framework] project.
```

### Phase 9: GitHub Setup (Optional)

Local initialization is complete at Phase 8. This phase optionally links the
project to GitHub. Everything here is read-only until you approve a specific
mutation, and every mutation is a separate approval. `/init` works fully
without gh or GitHub access: when `gh auth status` fails or gh is missing,
state that GitHub setup is skipped and finish.

**Step 1 — Detect (read-only).**

- `git remote get-url origin` — read the remote. If there is no origin, report
  "no origin remote" and proceed to Step 2.
- If an origin exists, verify the repository read-only before proposing
  anything:
  `gh repo view <owner>/<name> --json nameWithOwner,visibility,url`
  (owner and name parsed from the remote URL). Report visibility and URL.
- Never propose a mutation before this detection completes.

**Step 2 — Create the repository (only when missing, only with approval).**

- Determine the owner from `gh api user --jq .login` (read-only) or ask the
  user. Propose the exact command:
  `gh repo create <owner>/<repo> --source=. --remote=origin --<visibility>`
  with the repo name and visibility (private by default; public only on
  explicit user choice). Show owner, name, and visibility.
- Run `gh repo create` only after explicit approval. Never auto-create, never
  guess the owner, and never default a public repository.
- Verify after creation:
  `gh repo view <owner>/<repo> --json nameWithOwner,url` and report the result.

**Step 3 — First push (separate approval).**

- Propose `git push -u origin <branch>` for the current branch.
- Ask for separate approval. Creation and push are never the same approval.

**Step 4 — Central GitHub Project (optional, separate approval).**

- Offer to add the repository to the central development GitHub Project:
  `gh project list --owner <owner>` (read-only) to find the project, then
  `gh project item-add <number> --owner <owner> --url <repo-url>`.
- If the token lacks the `project` scope, report that enrollment requires
  `gh auth refresh -s read:project,project` and defer enrollment.
- Ask separately; declining leaves the repository and push untouched.

## Mode 2: Planning Context Only (`--context`)

### Phase 1: Discovery (brownfield)

If the project has existing code (brownfield — see auto-detection above), run read-only codebase analysis directly:

- Pi Fovea sketch/focus to map architecture patterns, data flow, domain boundaries, module structure.
- Read 3-5 representative files per subsystem to ground the map in real code.

If greenfield (no existing code), skip to requirements gathering.

### Phase 2: Requirements Gathering

Ask the user to define project direction:

1. **Project vision** — What is the project vision? (1-2 sentences)
2. **Target users** — Who are the primary users? (Developers, End users, Internal team, Both)
3. **Success criteria** — What defines success? (Stability, Speed, UX, Maintainability)

### Phase 3: Preview

Show the gathered requirements as a structured outline and ask for confirmation before writing files.

### Phase 4: Create Files

Write `.pi/roadmap.md` (vision, target users, feature roadmap with outcomes, dependencies, risks, non-goals) and `.pi/state.md` (current status, verification state, active decisions, next priorities). These files are for reference — they are not injected into prompts; use `read` on demand.

## Mode 3: User Profile Only (`--user`)

### Phase 1: Gather Preferences

Ask the user:

1. **Identity** — What is your name and role?
2. **Communication** — How detailed should AI responses be? (Concise, Detailed, Mixed)
3. **Git workflow** — How should git commits be handled? (Ask first, Auto-commit)
4. **Approval boundaries** — What actions require confirmation before execution?

### Phase 2: Preview

Show the captured preferences as a summary and ask for confirmation before writing.

### Phase 3: Create user.md

Write to `.pi/user.md` with the captured preferences. The file is for on-demand reference, not injected into prompts.

## Schema boundary

Detection, preview, and all interactive gathering are read-only. Before writing
any file, run the Schema loop inside one `fabric_exec`: `schema.hypothesize`
(evidence: `file_contains`/`file_sha256` literals or the `canonical-check`
trusted command) → `schema.verify` → `schema.commit` with declared operations
and nonempty postconditions. Only `committed` authorizes the write; then write
the declared artifacts in the same `fabric_exec`. Mark completed steps
`[DONE:n]`. If verification fails or scope changes, do not mutate. After verification, record the gate decision (passed/disposition; evidence kinds: command, artifact, trace, custom) with the session's workflow recorder when available, or carry it in the completion report.

**Dual mode.** Read-only discovery is identical in both modes; only mutation
authorization differs. Schema mode (`schema.status().mode === "enforce"`):
the loop above applies. Main-session mode (guard off or project untrusted):
propose each mutation to the user and apply only after explicit approval of the
exact action and files. Detect at the mutation boundary: `schema.status()`
reports `enforce` → Schema mode; otherwise → main-session mode.

## Output

Report what was created and how it was verified. For each artifact state
created, updated, skipped, clarified, and verified:

1. AGENTS.md — created/updated in place; state the Project overview and Architecture sections rendered.
2. project.md — created/updated; state the sections covered and open questions marked.
3. tech-stack.md — regenerated; state detected dependencies vs host tools and command status.
4. roadmap.md + state.md — created/skipped; state the direction captured.
5. user.md — created/skipped; state the preferences captured.
6. Evidence — list the commands run and their results; name anything verified only by inspection.
7. Cross-file consistency — confirm commands, counts, paths, and architecture terms agree across artifacts, or list the disagreements.
8. GitHub setup — created/linked/skipped; state owner, visibility, push status, and central GitHub Project enrollment (approved, deferred, or declined).
9. Recommended next command: `/plan` to start planning, `/research` to explore the codebase, or just describe what you want to build.

---
description: Create a specification with PRD, tasks, and workspace setup
argument-hint: '<description>'
---

# Create: $ARGUMENTS

Create a specification (PRD), set up the workspace, and define executable tasks — ready for `/ship`.

> **Workflow:** **`/create`** → `/ship`

## Parse Arguments

| Argument        | Default  | Description                       |
| --------------- | -------- | --------------------------------- |
| `<description>` | required | What to build/fix (quoted string) |

## Determine Input Type

| Input Type  | Detection            | Action                        |
| ----------- | -------------------- | ----------------------------- |
| Quoted text | `"description here"` | Create PRD from description   |
| Short form  | Simple string        | Ask for more detail if needed |

## Before You Create

- **Be certain**: only create specs with clear scope
- **Don't over-spec**: if the description is vague, ask clarifying questions first
- **Check duplicates**: always check for existing work
- **No implementation**: create specs and workspace — do not write implementation code
- **Verify PRD**: before saving, verify all sections are filled (no placeholders)
- **Flag uncertainty**: use `[NEEDS CLARIFICATION]` markers for unknowns — never guess silently

## Phase 1: Duplicate Check

### Context Search

Search `.pi/MEMORY.md` for prior decisions and similar work:

```bash
rg -n "topic" .pi/MEMORY.md
```

Also search code history: `git log --oneline -20` for related work, and Pi Fovea (`extensions.fovea_focus`)
search for existing features that might already cover the request.

### Existing Work Check

Check `.pi/work/.active` for existing work in progress. If an active ID exists and `.pi/work/<id>/spec.md` exists, ask the user if they want to continue with `/ship` instead.

## Phase 2: Choose Research Depth

Ask the user how much codebase research they need:

- **Deep (recommended for complex work)** — patterns, tests, deps, best practices
- **Standard** — patterns + tests
- **Minimal** — quick file scan
- **Skip** — they know the codebase

## Phase 3: Gather Context (read-only)

Based on the research depth choice, run direct read-only discovery:

- **Deep**: Pi Fovea focus for relevant symbols/patterns; read tests to learn conventions; inspect dependency manifests; check docs for architecture guidance.
- **Standard**: Pi Fovea focus + read the tests for the nearest existing feature.
- **Minimal**: quick `rg`/Pi Fovea scan of the affected areas.
- **Skip**: no discovery; use existing AGENTS.md context.

While discovery runs, ask clarifying questions if the description lacks scope or expected outcome. For bugs, ask for reproduction steps and expected vs actual behavior.

## Phase 4: Initialize Workspace (local-first)

Create a local work record from the description; no GitHub access is needed.

- Derive a kebab-case slug from the description; it is the local work ID.
- If `$ARGUMENTS` includes `--issue <number>`, the record links an already-existing issue: verify it with `gh issue view <number>` scoped to the repository remote and record the verified number, URL, title, and repository. Use only the verified number; never guess or fabricate a URL. Linking is optional and read-only; /create never creates a GitHub issue.

Derive a kebab-case slug; the work ID is `<slug>`, or `<issue>-<slug>` when an existing issue is linked:

```bash
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g' | tr ' ' '-' | sed 's/--*/-/g; s/^-//; s/-$//')
ID="${SLUG}"
mkdir -p ".pi/work/$ID"
echo "$ID" > ".pi/work/.active"
```

Render `.pi/templates/issue.md` into `.pi/work/$ID/issue.md` with the work ID and, when an issue is linked, the verified issue number, URL, title, and repository. issue.md is the local identity record; the GitHub issue body owns the discussion when one exists.

## Phase 5: Determine PRD Rigor

Not every change needs a full spec. Assess complexity to choose the PRD level:

| Signal   | Lite PRD               | Full PRD                       |
| -------- | ---------------------- | ------------------------------ |
| Scope    | Simple, single-concern | Cross-cutting, multi-system    |
| Risk     | Low blast radius       | Touches auth, data, public API |
| Unknowns | Few                    | Many open questions            |

Lite PRD when the change is small and well understood; full PRD otherwise.

## Phase 6: Write the PRD

Render the PRD from `.pi/templates/prd.md` into `.pi/work/$ID/spec.md`, filling every section with the gathered requirements, goals, non-goals, and acceptance criteria.

Every acceptance criterion must be checkable:

- Observable behavior (what the user or system can verify)
- A verification command or manual check per criterion
- No criterion like "make it good" or "works correctly" without a concrete check

Flag unknowns with `[NEEDS CLARIFICATION]`.

## Phase 7: Define Tasks

Render the task breakdown from `.pi/templates/tasks.md` into `.pi/work/$ID/tasks.md`.

Each task must be:

- Independently shippable (its own end state)
- Verifiable (an explicit check exists)
- Scoped with `depends_on` / `files` metadata so `/ship` can order them

## Schema boundary

Research, question-asking, and PRD drafting are read-only. Before writing any file, run the Schema loop inside one `fabric_exec`: `schema.hypothesize` (evidence: `file_contains`/`file_sha256` literals or the `canonical-check` trusted command) → `schema.verify` → `schema.commit` with declared operations and nonempty postconditions. Only `committed` authorizes the write; then write in the same `fabric_exec`. Mark completed steps `[DONE:n]`. If verification fails or scope changes, do not mutate. After verification, record the gate decision (passed/disposition; evidence kinds: command, artifact, trace, custom) with the session's workflow recorder when available, or carry it in the completion report.

**Dual mode.** Read-only discovery is identical in both modes; only mutation authorization differs. Schema mode (`schema.status().mode === "enforce"`): the loop above applies. Main-session mode (guard off or project untrusted): propose each mutation to the user and apply only after explicit approval of the exact action and files. Detect at the mutation boundary: `schema.status()` reports `enforce` → Schema mode; otherwise → main-session mode.

## Output

1. **Work ID:** `<slug>` (or `<issue>-<slug>` when an existing issue is linked)
2. **PRD:** `.pi/work/$ID/spec.md`
3. **Tasks:** `.pi/work/$ID/tasks.md`
4. **Workspace:** ID recorded in `.pi/work/.active`
5. **Next step:** `/ship $ID` to implement

## Related Commands

| Need               | Command   |
| ------------------ | --------- |
| Deeper planning    | `/plan`   |
| Implement the spec | `/ship`   |
| Verify gates       | `/verify` |

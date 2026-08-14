---
name: brainstorming
description: 'Use when creating or developing, before writing code or implementation plans - refines rough ideas into designs through collaborative questioning, alternative exploration, and incremental validation.'
---

# Brainstorming

<HARD-GATE>
Do not write code, draft an implementation plan, or invoke `incremental-implementation` until the user has approved a design.
</HARD-GATE>

## When to Use

Rough idea, PRD, ADR draft, or vague feature request; "What if we…", "I'm thinking…", "Let's try…" before code; multiple plausible approaches where the choice is load-bearing.

## When NOT to Use

Bug fixes with known root cause; mechanical refactor with a clear spec; trivial one-liner or config value. Well-defined requests do not need brainstorming.

## Core Principle

**Classify unknowns before acting.**

- **Known knowns** — in the prompt.
- **Known unknowns** — ask the user.
- **Unknown knowns** — you'd recognize the answer if you saw it. Show 2–4 cheap variants or point at a reference.
- **Unknown unknowns** — ask the model to teach you the criteria.

Map the gap before proposing. A simpler approach often exists — say so.

## Workflow

1. **Map unknowns** — classify the gap; state assumptions for ambiguous cases.
2. **Variants** — for novel or design-heavy work, show 2–4 cheap variants _before_ recommending one. Each names the trade-off it accepts.
3. **Interview** — one question at a time on architecture, data model, or UX. Multiple-choice when options are genuinely live. Reference-pointing beats 200 words.
4. **Validate** — incremental check-in: "does this match what you wanted?" before going deeper.
5. **Hand off** — after approval, switch to `planning-and-task-breakdown` (or `incremental-implementation` for trivial slices).

## Cheat Sheet

| Situation                                 | Default action                                   |
| ----------------------------------------- | ------------------------------------------------ |
| Spec concrete, single-file                | Skip brainstorm, implement.                      |
| Spec concrete, multi-file or design-heavy | One question on the riskiest unknown, then plan. |
| Spec vague                                | Variants first, then interview.                  |
| "Sanity check" / "prototype"              | Use `prototype` skill.                           |
| Multiple valid approaches                 | Show 2–4 variants with trade-offs.               |
| New library / framework                   | Point at official docs/source.                   |

## Red Flags

Skipping variants for a design decision; asking 5 questions in one message; "we can add caching later" hand-waving in a production-bound design; starting code or plan before approval; "YAGNI" used to dismiss a stated requirement.

## Anti-Patterns

**The 200-word answer** when 2–4 variants surface the same trade-off; **the leading question** collapses the brainstorm; **the silent assumption** picks a stack without naming it; **premature implementation** drafts a plan before design approval.

## Skill Result Contract

```xml
<skill_result>
  <skill>brainstorming</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Unknowns mapped, variants shown (if novel), design approved by user</evidence>
  <artifacts>Design summary or "skipped — spec was concrete"</artifacts>
  <risks>Unresolved questions, scope creep, premature commitment, or none</risks>
</skill_result>
```

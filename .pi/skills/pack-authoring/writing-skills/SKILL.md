---
name: writing-skills
description: 'Use when creating, editing, or verifying skills - TDD on behavior, pressure tests, progressive disclosure, token budgets.'
disable-model-invocation: true
---

# Writing Skills

## Iron Law (Same as TDD)

<EXTREMELY-IMPORTANT>
**NO SKILL WITHOUT A FAILING TEST FIRST.** A skill is a behavior change in the agent that loads it. Test the behavior, not the prose.
</EXTREMELY-IMPORTANT>

**REQUIRED BACKGROUND:** test-driven-development.

The test is a pressure scenario plus a rubric.

## The Loop

```
RED:      subagent WITHOUT skill — watch it fail
GREEN:    smallest skill that flips the failure
REFACTOR: close loopholes the test exposed
```

## Match the Form to the Failure

<EXTREMELY-IMPORTANT>
**Prohibitions backfire on shaping problems.** A "don't do X" rule suppresses output without teaching the right one. Use a recipe.
</EXTREMELY-IMPORTANT>

Match form to failure: recipe for skipped tests, delete-list for oversize diffs, template + `<evidence>` for unverified claims, variants + interview for uncertainty.

## Workflow

1. **Gap.** Skill that would have prevented the failure?
2. **RED** — scenario, subagent without skill. Score. Record.
3. **GREEN** — minimum skill that flips the failure. Re-run. Iterate.
4. **REFACTOR** — adversarial prompts. Skill must hold.
5. **Compress.** Pass → tighten. Compressed skills that pass are load-bearing.
6. **Commit + index.** Reference it in the pack router when load-bearing.

## Context Engineering

- **progressive disclosure**: the description is the retrieval surface; leaves load only when a task matches. A vague description is a retrieval miss.
- **Trigger precision**: "Use when <condition>" plus the capability. No filler.
- **Token target**: leaf under 500 words; router under 190. `validate-skill-packs.mjs` enforces the visible metadata budget. Compress until pressure tests pass.

## Pressure-Testing Scenarios

| Type                  | What it tests                                         |
| --------------------- | ----------------------------------------------------- |
| **Skipping iron law** | "I'm in a hurry"                                      |
| **Rationalization**   | "This is obvious"                                     |
| **Edge case**         | "My case is special"                                  |
| **Retrieval miss**    | Description too vague to route; the leaf never loads. |
| **Trigger ambiguity** | Two descriptions match one task; the wrong leaf wins. |

## Rubric

```
Score: /5 — iron law 1, workflow 0–3, red flags 1, contract 1, refused to skip 1. Pass: 4/5 twice.
```

## Skill Anatomy

```
---
name: <kebab>
description: "Use when <triggering condition>..."
---
# <Title>
## Core Principle | When to Use / NOT | Workflow | Red Flags | Contract
```

Mark skipped rules with `<HARD-GATE>` / `<EXTREMELY-IMPORTANT>`.

## Red Flags (Writing the Skill)

Wrote before RED; "obviously correct" with no test; description vague or over budget; iron law missing; compression deleted a load-bearing marker; boilerplate contract.

## Anti-Patterns

**The "obvious" skill** (untested); **the bible** (cannot load); **the summarizer** (rephrases AGENTS.md); **the tutorial** (move to docs).

## Skill Result Contract

```
<skill_result>
  <skill>writing-skills</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>RED, GREEN, REFACTOR runs</evidence>
  <artifacts>Scenario, rubric, skill</artifacts>
  <risks>Untested, regressed marker, none</risks>
</skill_result>
```

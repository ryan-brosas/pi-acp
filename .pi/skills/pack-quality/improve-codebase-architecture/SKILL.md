---
name: improve-codebase-architecture
description: Use when the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more testable and AI-navigable.
disable-model-invocation: true
---


# Improve Codebase Architecture

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Architecture change = behavior-preserving.** Tests stay green.
- **One axis at a time.** Not naming + layering + packaging in one PR.
- **Each step independently shippable.** Strangler fig, not big-bang.
- **Measure before and after.** Cyclomatic complexity, coupling, build time.
- **Make easy changes easy, hard changes possible.** Not "perfect". Just better.
</EXTREMELY-IMPORTANT>

## When to Use

"Improve the architecture"; module too coupled; tests hard to write; "this class is too big"; AI tools struggle; build/test time high; on-boarding painful.

## When NOT to Use

Architecture is fine; "redesign" without a problem; rewrites (different risk); user wants features.

## The Refactoring Ladder

```
1. Rename    (~hours, high signal)
2. Extract   (~hours)
3. Move      (~hours)
4. Restructure (interface, layering — ~days)
5. Repackage (~weeks)
6. Rewrite   (~months)
```

Start at the bottom. Don't jump to 5.

## Approach

1. **Identify the smell.** Don't refactor what isn't broken.
2. **Measure baseline.** Coupling, complexity, build time. Record.
3. **Pick the smallest change.** One rename, extract, or move.
4. **Verify behavior preserved.** Tests pass.
5. **Measure again.** Did the metric improve?
6. **Commit.** One commit per change.
7. **Repeat.** Or stop.

## Common Smells

| Smell | Indicator | First move |
|---|---|---|
| Long method | > 30 lines, multiple responsibilities | Extract method |
| God class | 1000+ lines, 20+ methods | Extract class |
| Tight coupling | Changing A forces changes in B | Dependency injection |
| Feature envy | Method uses B's data more | Move method to B |
| Primitive obsession | Strings/numbers for domain | Value objects / branded |
| Long parameter list | > 3 params, especially bools | Parameter object / options |
| Shotgun surgery | One change touches 5+ files | Consolidate |
| Divergent change | One class changes for many reasons | Split by axis |

## Module Boundaries

**Good**: single purpose, small interface, changes localized, testable.
**Bad**: two things, wide interface, one change touches many files, tests mock the world.

## When to Stop

Stop if tests are easy to write, build time decreased, new features easy, onboarding faster, AI tools navigate. Continue otherwise.

## Strangler Fig Pattern

For larger refactors:
1. **Build new alongside old.** Both work.
2. **Route traffic incrementally.** 10% → 50% → 100%.
3. **Remove old path.** Once 100% on new.
4. **One piece at a time.** Module by module.

## Common Mistakes

Refactor without tests; big-bang rewrite; "perfect is the enemy" → over-polish; rename without target; refactor + feature in one PR; no measurement.

## Red Flags

Refactor without tests; no baseline; "I think this is better" (no metric); "rewrite it"; multiple axes; refactor + feature; tests skipped; "moved it, better" (no proof).

## Anti-Patterns

**Refactor without tests**; **no baseline**; **"rewrite"**; **multiple axes**; **refactor + feature**; **"I think"**; **"moved it"**; **one PR, many changes**.

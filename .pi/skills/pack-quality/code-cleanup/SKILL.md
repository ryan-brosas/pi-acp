---
name: code-cleanup
description: "Use when behavior works but the diff is noisy, repetitive, over-complicated, or AI-shaped - lock behavior first, simplify the changed code, and re-verify without expanding scope."
disable-model-invocation: true
---


# Code Cleanup

## When to Use

Tests/build/typecheck pass but the diff is clumsy; feature works but has duplication, over-nesting, dead code, awkward naming; final simplification before review/merge; "broken window" needs boarding up.

## When NOT to Use

Behavior is broken or unverified; "cleanup" is cover for redesign; cleanup spreads to unrelated files; can't prove nothing broke.

## Core Principle

**Lock behavior first. Then simplify. Then re-verify.** Sequence: behavior locked → simplify → re-verify nothing changed. If any step fails, stop.

## Workflow

1. **Lock behavior.** Run the relevant tests + typecheck + lint. Save the output. This is your "before" baseline.
2. **Identify smell.** Use `fallow` (if available) for dead code, dupes, complexity. Otherwise: read the diff, mark spots that feel off.
3. **Simplify, in order:**
   - **Delete** (dead code, comments that restate, unused exports) — easiest, highest impact
   - **Rename** (clearer names, remove prefixes/suffixes) — cheap, high signal
   - **Extract** (a variable, a helper) — only if nameable and reused
   - **Inline** (a one-use wrapper) — only if the wrapper adds no clarity
   - **Restructure** (split a function, lift a conditional) — last resort, highest risk
4. **Re-verify.** Same tests, same typecheck, same lint. Outputs match "before" baseline.
5. **Diff review.** Anything outside the cleanup scope? Split it out.

## Anti-Simplification Patterns

- Adding an abstraction for "future use" — speculative, not cleanup
- "Improving" the architecture under cover of "cleanup" — separate change
- Renaming things the user named (breaks their mental model)
- "Fixing" unrelated lint warnings in the same diff
- Reformatting the whole file (no behavior change, but noise in diff)

## Common Mistakes

Cleanup before behavior is locked (can't prove nothing broke); expanding scope (renaming across the codebase); adding abstractions for "future reuse"; deleting without checking consumers; reformatting the whole file; "improving" code style in unrelated parts; "we'll add tests after" (the tests are how you prove nothing broke).

## Red Flags

Cleanup before tests pass; "I just want to refactor this"; expanding into unrelated files; "while I'm here" fixes; tests deleted (not the cleanup target); reformatting the whole file; rename of public API; no baseline saved; re-verify skipped; "I'll write tests for the new structure later".

## Self-Quiz

- Is behavior locked (tests + typecheck + lint passing before)?
- Is each change *deletion or simplification*, not addition?
- Did I re-run the same checks after, and compare to baseline?
- Are all changes scoped to what was actually noisy?
- Did I avoid renaming public APIs or restructuring unrelated code?

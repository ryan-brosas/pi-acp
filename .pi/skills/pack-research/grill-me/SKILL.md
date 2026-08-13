---
name: grill-me
description: Use when you have a rough idea, ADR, PRD, or spec that needs to survive scrutiny before code is written.
disable-model-invocation: true
---


# Grill Me

## When to Use

You have a plan, spec, ADR, or architecture that you want to stress-test before committing to implementation. You want someone to find the holes.

## Core Principle

**A plan that survives a good grilling is a plan worth implementing.** A plan that falls apart under questions would have fallen apart during implementation, costing more.

## How to Grill

Ask:
- "What assumptions are you making that could be wrong?"
- "What's the most likely thing to fail?"
- "What if X is 10x larger / smaller / slower?"
- "What's the cost of being wrong?"
- "What's the simplest way to test this?"
- "What's the hardest part? Why?"
- "What's the rollback plan?"
- "What would make this a mistake?"
- "Who disagrees with this? Why?"
- "What's the non-goal everyone forgets?"
- "What are we not talking about?"

One question at a time. Let the person answer fully before asking another.

## What a Good Grilling Looks Like

- Questions surface assumptions, not opinions.
- The griller is curious, not confrontational.
- The grillee answers in "I think" and "I'm assuming", not "it's obvious".
- After 10-15 questions, the plan is either stronger or abandoned.
- The griller doesn't need to "win" — they need to find the hole.

## Common Targets

| Target | Question |
|---|---|
| Cost estimate | "What if it takes 3x as long?" |
| Scale estimate | "What if traffic grows 10x this month?" |
| One-vendor risk | "What if vendor shuts down?" |
| "Just use X" | "What does X not do?" |
| "We'll iterate" | "What's the first working version look like?" |
| "It's simple" | "Define simple. How many moving parts?" |
| "Everyone agrees" | "Who did you not ask?" |
| "No dependencies" | "What do you depend on that you don't control?" |

## When to Stop Grilling

Stop when the grillee has a concrete, specific answer to each question, not "I'll figure it out later." Stop when the questions are repeating (same shape, different topic).

## Common Mistakes

Asking 5 questions in one message; grilling from a position of "I know better" (stifles ideas); stopping too early (first two questions are easy); stopping too late (grilling the trivial parts); not documenting the answers; "grilling as attack" (destroys trust, not plans).

## Red Flags

No assumptions stated; "I'll figure it out later" as a crutch; "everyone agrees" without asking everyone; cost estimate without a range; "it's simple" without definition; no rollback plan; "we'll iterate" before v1 is defined; "no dependencies" without checking; vulnerability mentioned, dismissed; "I'm not worried about X" (X is the thing to worry about).

## Anti-Patterns

**5 questions at once**; **"I know better"** (stifles); **stop too early** (first 2 are easy); **grill the trivial**; **no doc**; **attack mode**.

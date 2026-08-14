---
name: design-system-audit
description: Use when auditing an existing design system for consistency — token audits, pattern analysis, visual comparison against design specs. Load AFTER implementation to review, not during initial build.
disable-model-invocation: true
---

# Design System Audit

## When to Use

Reviewing an existing design system for consistency; checking token coverage; comparing implementation vs Figma spec; checking for silent drift; pre-launch visual QA; "does our design system hold together?"

## Core Principle

**A design system is a contract between designers and developers.** The audit checks if both sides are honoring it. Broken tokens, mismatched spec, inconsistent patterns — each is a breach.

## Audit Layers

1. **Token coverage** — are all spec tokens implemented? Any missing?
2. **Token usage** — are tokens used? Or raw values?
3. **Component consistency** — does every component use the tokens?
4. **Spec alignment** — does the component match the Figma spec?
5. **Composition patterns** — do the components compose as expected?

## Token Audit

```json
{
  "missing": ["color.warning.bg", "spacing.6xl"],
  "raw-values": ["16px margin in Dialog (should use spacing.4)", "#333 instead of color.text.secondary in Tooltip"],
  "drifted": ["Button radius is 8px, spec says 6px"]
}
```

Every raw value is a breach. Every missing token is a gap. Every drift is a visual inconsistency.

## Pattern Checks

- "How many distinct button styles exist?" (should be 3-5: primary, secondary, outline, ghost, danger)
- "How many spacing values are used?" (should be 5-10, not 30+)
- "How many typography styles?" (should be 8-12, not 1 or 30)
- "Are borders consistent?" (same width, same color across components)
- "Are focus states present?" (every interactive element)
- "Is there a dark mode?" (and does it handle all tokens?)

## Spec Alignment

Compare the implementation against the design spec:

| Check       | Method                                |
| ----------- | ------------------------------------- |
| Color       | Hex values vs spec tokens             |
| Typography  | Family, size, weight, line-height     |
| Spacing     | Padding, margin, gap                  |
| Radius      | Border radius on every component      |
| Shadow      | Shadow tokens                         |
| Iconography | Size, stroke, alignment               |
| States      | Hover, active, disabled, focus, error |
| Motion      | Duration, easing, transforms          |

## Reporting

For each finding:

```
[severity] Component / Token: What is wrong
  - Expected: <spec>
  - Found: <implementation>
  - Fix: <what to change>
```

Severity: BLOCKER, SHOULD-FIX, NIT.

## Common Mistakes

No token audit (misses the most common drift); audit from memory, not from the spec; "looks fine" without measuring; checking only one layer (tokens but not patterns); no severity; "I'll fix it later" (fix now); audit on outdated codebase; comparing against an old spec; missing dark mode; missing focus states; "the component works" (does it adhere to the system?).

## Red Flags

Raw values where tokens exist; 5+ button variants; 30+ distinct spacing values; missing focus states; no dark mode (or dark mode just inverts); "looks fine" without measuring; spec and code diverge; missing states (hover, disabled, error); component in Figma ≠ component in code; no audit at all.

## Anti-Patterns

**No token audit**; **"looks fine"**; **one layer only**; **no severity**; **"fix later"**; **audit on outdated code**; **compare against old spec**; **missing dark mode**; **missing focus states**; **spec ≠ code**.

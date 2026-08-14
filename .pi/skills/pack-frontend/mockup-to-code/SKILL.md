---
name: mockup-to-code
description: Use when converting UI mockups, screenshots, Figma/Sketch designs, wireframes, or building component libraries from design systems into production-ready code
disable-model-invocation: true
---


# Mockup to Code

## When to Use

You have a visual design (Figma, Sketch, screenshot, wireframe, hand-drawn mockup) and need to implement it in code. The design exists as pixels, the code must match.

## Core Principle

**The design is the spec.** If the code doesn't match the design, the code is wrong. "Close enough" is a design debt.

## Workflow

1. **Audit the design.** What components exist? What states? What tokens? Screenshot every state.
2. **Set up tokens.** Colors, typography, spacing, radius — extract from the design. No magic numbers.
3. **Build the components.** One at a time, in isolation. Button → Input → Card → Layout.
4. **Compose the page.** Components into sections, sections into pages.
5. **Validate against the design.** Pixel-precision on spacing, type, color. Screenshot and compare.
6. **Iterate.** Design feedback → adjust → re-validate.

## Token Extraction

Map the visual design to a design system:
- Colors → `--color-*` CSS variables or theme tokens
- Typography → font family, size, weight, line-height
- Spacing → smallest unit in the design (often 4px or 8px)
- Radius → button, card, input radii
- Shadows → depth levels (elevation, modal, tooltip)

"Magic numbers" in the implementation mean the token is missing.

## Component Order

Build in this order:
1. **Typography** (headings, body, labels — the base layer)
2. **Color tokens** (background, text, border, accent)
3. **Layout primitives** (Container, Stack, Grid)
4. **Atomic components** (Button, Input, Tag, Badge)
5. **Composite components** (Card, Modal, Form, Table)
6. **Page sections** (Header, Hero, Sidebar, Footer)
7. **Full page** (compose the sections)

Each step validates the previous.

## Validation

```ts
// Compare screenshot vs design
// Option 1: overlay (screenshot overlay, adjust opacity)
// Option 2: Playwright screenshot comparison
// Option 3: manual review (designer inspects the implementation)
```

If the designer can't tell the difference, it's done. If they can, fix the gap.

## When the Design Is Incomplete

- Missing states (hover, error, loading, empty): ask or define based on the system.
- Missing responsive: ask or define for mobile first.
- Missing tokens: extract from the design, or ask.
- Missing dark mode: ask or ship light only.

Document the decisions. "Assumed hover state based on spec for button."

## Common Mistakes

"No token" (magic numbers); "close enough" (visible gap); missing states (no hover, no error); "I'll add responsive later" (mobile-first); "I'll fix the tokens later" (tokens first); component order wrong (skip typography, build carousel); no validation step; "designer says it's fine" (ask specifically); building from memory, not from the design.

## Red Flags

Magic numbers; "close enough"; missing states; no tokens; "responsive later"; no validation; component order wrong; building from memory; design not accessible; design and code diverge; "I'll fix it later" for visual gaps.

## Anti-Patterns

**Magic numbers** (tokens); **"close enough"** (design is the spec); **missing states**; **"responsive later"**; **no tokens**; **no validation**; **wrong component order**; **"from memory"**; **"fix later"**.

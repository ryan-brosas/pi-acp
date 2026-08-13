---
name: design-taste-frontend
description: "Use when evaluating frontend visual quality and taste and no specific aesthetic overlay applies - assess proportion, contrast, spacing, and hierarchy."
disable-model-invocation: true
---


# Design Taste (Frontend Base)

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Typography is the design.** 90% of perceived quality. Get the type right; everything else follows.
- **Restraint over decoration.** No gradients, no glassmorphism, no neon, no "trendy" UI patterns. Boring is correct.
- **Spacing is a system, not a vibe.** Use a 4px or 8px scale. No magic numbers.
- **Color is a vocabulary, not a theme.** 1 brand color, 1-2 neutrals, 1 accent. No rainbow palettes.
- **Whitespace is content.** Cramming reduces perceived quality more than any other mistake.
</EXTREMELY-IMPORTANT>

## Typography

- One typeface family. Maximum two (display + body). Not three.
- Establish a modular scale (1.2 or 1.25 ratio): 12, 14, 16, 20, 24, 32, 48, 64
- Line-height: 1.4-1.6 for body, 1.1-1.2 for display
- Measure: 50-75 characters per line for body text
- Weight contrast: pair regular (400) with semibold (600). Avoid light weights for body.
- Use real italic, never oblique. Use real small caps if you have them.

## Color

- **Neutrals first.** 9-step ramp (50-900). Get this right.
- **Brand color second.** One hue, 5-9 steps. Sparingly (CTA, links, brand).
- **Accent (optional).** Complementary hue for status.
- **No pure black/white.** Use neutral-900 / neutral-50.
- Contrast: body ≥4.5:1, large ≥3:1, UI ≥3:1.

## Spacing

- 4px base scale: 0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128
- Use it everywhere: padding, margin, gap, even border-radius
- Vertical rhythm: line-height × font-size, in increments of the spacing scale
- Don't hand-tune. Use the tokens.

## Component Architecture

| Component | Anatomy |
|---|---|
| Button | height, padding-x, font-size, weight, radius, 3 color states |
| Input | button + border + focus ring |
| Card | padding, radius, border-or-shadow, background |
| Modal | overlay, panel, padding, max-width, focus trap |
| Table | row-height, cell-padding, header-weight, divider |

Define each as a token. Don't freestyle at the call site.

## Layout

- 8pt grid major, 4pt inline
- Prose max-width: 65ch
- Sidebar: 240-280px nav, content fills the rest
- Dashboard: 12-col grid, 24px gutters
- Mobile-first: 360px first, expand.

## Motion

- Duration: 150-300ms state changes, 300-500ms entrances
- Easing: ease-out entrances, ease-in exits, ease-in-out state
- Distance: 8-16px translates, 4-8% scales
- **No bounces, no elastic.** Linear-ish curves feel more professional.
- Respect `prefers-reduced-motion`. Disable for those users.

## Anti-Patterns (LLM defaults)

Centered everything; hero with abstract gradient; trendy colors (neon, cyberpunk, "AI purple", pastel); stock photos in placeholders; cards with shadow+borders+background; "Click here" / "Learn more" buttons; mismatched icons; animation on every interaction; glassmorphism/neumorphism/brutalism without intention.

## The 5-Second Test

5 seconds → what's remembered? If "lots of stuff", failed. The answer: type, spacing, hierarchy. Nothing else.

## Red Flags

3+ font families; pure black/white; inconsistent spacing scale; no focus states; buttons without clear hierarchy (all look the same); dark mode that inverts without thought; icons that don't match text; animation on every interaction; cards with 3+ visual treatments.

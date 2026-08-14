---
name: redesign-existing-projects
description: 'Use when upgrading an existing website or app to premium visual quality - audits the current design, identifies generic AI patterns, and applies high-end standards without breaking functionality.'
disable-model-invocation: true
---

# Redesign Existing Projects

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Preserve functionality.** Redesign the visual layer; never change behavior.
- **Audit before designing.** Read current design, identify what's working, name the AI tells.
- **Component-by-component, not page-by-page.** One pattern at a time.
- **Real data, not Lorem Ipsum.** Sample data hides problems.
- **Match the brand voice.** Don't impose "fun" on a "trust me" product.
</EXTREMELY-IMPORTANT>

## Audit: What to Look For

| Tells                 | Example                                 |
| --------------------- | --------------------------------------- |
| AI-default colors     | Pastel rainbow, "AI purple", neon       |
| AI-default typography | Multiple families, random weights       |
| Generic layouts       | Centered hero with abstract gradient    |
| Stock-feel copy       | "Welcome to our amazing platform"       |
| Inconsistent spacing  | Magic numbers, no scale                 |
| Lorem Ipsum           | Sample data in production pages         |
| Missing focus states  | Buttons without `:focus-visible`        |
| Card overload         | Shadow + border + bg on everything      |
| Animation defaults    | Bounces, transitions on everything      |
| "Premium" gestures    | Gold gradients, glass blurs, no purpose |

## Audit Process

1. **Screenshot** every screen, every state (loading, error, empty, success).
2. **Note what's working** — don't throw out good design to make a point.
3. **List AI tells** specifically. Not "looks generic" — "hero has abstract gradient + centered logo + 3 CTA buttons".
4. **Identify brand voice** — serious / playful / editorial / industrial / minimal. Match it.
5. **Pick the load-bearing element.** Usually typography.

## Design Strategy

**Typography first.** Establish the type system, then build around it.

**Color second.** Build the neutral ramp, add brand color, resist accents.

**Spacing third.** Apply the scale everywhere.

**Components fourth.** Buttons, inputs, cards, modals — define once, use everywhere.

**Layout last.** Compose components into pages.

## Component-by-Component Migration

For each component:

1. Define the new version (token-driven)
2. Implement in isolation (Storybook or similar)
3. Ship behind a feature flag if possible
4. A/B test if traffic allows
5. Remove the old version once new is stable

Don't redesign the whole site at once. That's a rewrite, not a redesign.

## What NOT to Change

- Information architecture (menus, navigation structure)
- User flows (signup, checkout, search)
- Existing copy unless explicitly asked
- Database / API contracts
- Working components that just look "fine" (focus on tells first)

## Common Mistakes

Redesigning without auditing; changing IA; new copy without asking; redesigning all at once; missing a11y; not testing with real data; "premium" = "more visual"; removing features; only testing happy path.

## Red Flags

No screenshot audit; "more premium" without definition; changing IA in visual redesign; invented copy; missing focus states; no real-data test; "added gradients to make it pop"; no tokens; mobile not considered.

## Anti-Patterns

**"Looked generic"** (no audit); **"Make it pop"** (adds noise); **"Changed copy too"** (out of scope); **"Ship the whole redesign"** (component-by-component); **"Mobile later"** (mobile-first); **"Dark mode = invert"**.

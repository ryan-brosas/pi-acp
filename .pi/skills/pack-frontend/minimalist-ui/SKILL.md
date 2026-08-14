---
name: minimalist-ui
description: 'Use when the user requests clean, editorial, or minimalist aesthetics instead of design-taste-frontend - warm monochrome, typographic contrast, flat bento grids, muted pastels.'
disable-model-invocation: true
---

# Minimalist UI

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Less, but better.** One font, one accent, one button style. Edit ruthlessly.
- **Whitespace is the design.** Generous padding, large line-height, breathing room.
- **Typography carries it.** No icons where text works. No images where type works.
- **No decoration.** No gradients, no shadows beyond `0 1px 2px rgba(0,0,0,0.05)`, no rounded > 8px.
- **Bento grids, not cards.** Flat groupings, not elevated boxes.
</EXTREMELY-IMPORTANT>

## When to Use

User requests "minimal", "clean", "editorial"; product is content-first (writing, code, design); minimal chrome is the goal; "Apple-y" feel; "Linear-y" feel; high information density without visual noise.

## When NOT to Use

Product needs visual warmth (use `design-taste-frontend` or `high-end-visual-design`); playful / consumer brand; image-heavy (e.g., portfolio, fashion); user requested "playful" or "colorful" explicitly.

## Color (Warm Monochrome)

```css
:root {
  --bg: #fafaf9; /* warm off-white */
  --fg: #1a1a1a; /* warm near-black */
  --muted: #6b6b6b;
  --border: #e5e5e4;
  --accent: #c96442; /* terracotta, dusty rose, deep amber */
  --accent-soft: #f4ebe5;
}
```

NEVER: pure black `#000`, pure white `#fff`, neon, "AI purple", gradients.

## Typography

```css
:root {
  --font-sans: 'Inter', 'Söhne', -apple-system, system-ui;
  --font-serif: 'Newsreader', 'Spectral', Georgia, serif; /* optional editorial */
  --font-mono: 'JetBrains Mono', 'Berkeley Mono', monospace;
}

body {
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.6;
  color: var(--fg);
}
h1 {
  font-size: 2.5rem;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
h2 {
  font-size: 1.75rem;
  line-height: 1.3;
}
h3 {
  font-size: 1.25rem;
  line-height: 1.4;
}
```

ONE family. Maybe a serif for editorial hero. Never three.

## Spacing

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
}
```

Section padding: `var(--space-16)` to `var(--space-24)`. Generous. Never cramped.

## Components

```tsx
// Button — flat, no shadow
<button className="px-4 py-2 bg-fg text-bg rounded-md hover:opacity-90">
  Action
</button>

// Section — flat, hairline border
<section className="border border-border rounded-lg p-6">...</section>
```

- `border-radius`: 6-8px max (0 is fine).
- `box-shadow`: none, or `0 1px 2px rgba(0,0,0,0.05)` max.
- `border`: hairline, `1px` solid `--border`.

## Bento Grid

```tsx
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-8 p-8 border rounded-lg">Main</div>
  <div className="col-span-4 p-8 border rounded-lg">Side</div>
</div>
```

Asymmetric grids. Wide main, narrow side. Different sizes. Section heights vary. Not a uniform 3x3 of identical boxes.

## Motion

Subtle, slow. 200-400ms. `ease-out`. No bounces. No springs. The motion is "this appeared", not "look at me".

## Common Mistakes

Too many colors; icon where text works; card with shadow + border + bg; rounded > 12px; gradient; neon; "playful" decoration; 3 font families; tight line-height; "make it pop" with size/weight; emoji as icon; glassmorphism; "premium" shadows.

## Red Flags

3+ colors; 3+ font families; gradient; shadow > 0 1px 2px; rounded > 12px; icon for every label; tight line-height; emoji in UI; glassmorphism; dark mode by inverting; "make it pop"; small text.

## Anti-Patterns

**3+ colors**; **3+ font families**; **gradient**; **heavy shadow**; **rounded > 12px**; **icon for every label**; **tight line-height**; **emoji in UI**; **glassmorphism**; **"make it pop"**.

# Typography Rules

## Core Principles

Typography carries hierarchy before color or decoration. Prioritize readability, rhythm, and intent.

- Use a single type scale ratio across the interface
- Keep body text highly readable before styling display text
- Limit font families: one display + one body (optional mono for code/data)
- Use weight and size for hierarchy before using color

## Fluid Type with clamp()

Use fluid sizing for responsive typography without breakpoint jumps:

```css
@theme {
  --text-xs: clamp(0.75rem, 0.72rem + 0.15vw, 0.8125rem);
  --text-sm: clamp(0.875rem, 0.84rem + 0.2vw, 0.9375rem);
  --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --text-lg: clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem);
  --text-xl: clamp(1.5rem, 1.35rem + 0.75vw, 2rem);
}
```

Never use fixed `px` for body text.

## Modular Scale

Pick one ratio and stick to it:

- **1.25** (major third) for practical UI
- **1.333** (perfect fourth) for editorial styles

Limit to 5-7 text sizes. Too many sizes destroys rhythm.

## Line Length and Rhythm

- Body measure: `max-width: 65ch`
- Comfortable line height: `1.45-1.7` for body text
- Tight headings: `1.05-1.25`
- Keep spacing tied to text rhythm (4pt system)

```css
.article {
  font-size: var(--text-base);
  line-height: 1.6;
  max-width: 65ch;
}
```

## Font Selection

Avoid default AI fingerprints:

- Banned as primary display fonts: Inter, Roboto, Arial, Open Sans, Lato, Montserrat, Space Grotesk, system-ui

Preferred directions:

- Sans: Instrument Sans, Plus Jakarta Sans, Outfit, Onest, Figtree, Urbanist
- Editorial serif: Fraunces, Newsreader

## OpenType Features

Use OpenType intentionally:

```css
.data-table {
  font-variant-numeric: tabular-nums;
}

.recipe {
  font-variant-numeric: diagonal-fractions;
}

.abbrev {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.04em;
}
```

## Dark Mode Typography

Light-on-dark text appears heavier. Adjust:

- Increase line height by `+0.05` to `+0.1`
- Reduce font weight if text feels too dense
- Avoid pure white text; use slightly tinted near-white

```css
@media (prefers-color-scheme: dark) {
  body {
    line-height: 1.65;
    color: oklch(0.93 0.01 264);
  }
}
```

## Quick Audit Checklist

- [ ] Body text uses `rem` or `em`, not `px`
- [ ] Type scale uses one ratio (1.25 or 1.333)
- [ ] Body lines capped around 65ch
- [ ] Headings and body have distinct line-height behavior
- [ ] OpenType features used for data/fractions/abbreviations where relevant
- [ ] Dark mode typography adjusted (not just color-inverted)

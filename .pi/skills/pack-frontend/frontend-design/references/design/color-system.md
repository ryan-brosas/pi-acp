# Color System — OKLCH Deep Guide

## Why OKLCH Over HSL

HSL is **not perceptually uniform** — `hsl(60, 100%, 50%)` (yellow) appears far brighter than `hsl(240, 100%, 50%)` (blue) at the same lightness. OKLCH fixes this: equal lightness steps _look_ equal.

```css
/* HSL: looks inconsistent */
--blue: hsl(240, 70%, 50%);
--green: hsl(120, 70%, 50%); /* Appears much brighter */

/* OKLCH: looks consistent */
--blue: oklch(0.55 0.22 264);
--green: oklch(0.55 0.18 145); /* Same perceived brightness */
```

## Two-Layer Token Architecture

**Layer 1 — Primitives** (raw values, never used directly in components):

```css
@theme {
  --blue-100: oklch(0.95 0.03 264);
  --blue-300: oklch(0.75 0.1 264);
  --blue-500: oklch(0.55 0.22 264);
  --blue-700: oklch(0.4 0.18 264);
  --blue-900: oklch(0.25 0.12 264);
}
```

**Layer 2 — Semantic** (what components reference; redefine for dark mode):

```css
@theme {
  --color-primary: var(--blue-500);
  --color-primary-hover: var(--blue-700);
  --color-surface: var(--neutral-50);
  --color-surface-elevated: var(--neutral-0);
  --color-text: var(--neutral-900);
  --color-text-muted: var(--neutral-600);
  --color-border: var(--neutral-200);
}

/* Dark mode: redefine ONLY semantic layer */
@media (prefers-color-scheme: dark) {
  @theme {
    --color-primary: var(--blue-300);
    --color-primary-hover: var(--blue-100);
    --color-surface: var(--neutral-900);
    --color-surface-elevated: var(--neutral-800);
    --color-text: var(--neutral-100);
    --color-text-muted: var(--neutral-400);
    --color-border: var(--neutral-700);
  }
}
```

## Tinted Neutrals

Never use pure gray (`chroma: 0`). Add `chroma: 0.01` hinted toward brand hue — barely visible but creates subconscious cohesion:

```css
@theme {
  /* Brand hue: 264 (blue) — neutrals subtly tinted */
  --neutral-0: oklch(1 0.005 264);
  --neutral-50: oklch(0.97 0.01 264);
  --neutral-100: oklch(0.93 0.01 264);
  --neutral-200: oklch(0.87 0.01 264);
  --neutral-400: oklch(0.7 0.01 264);
  --neutral-600: oklch(0.5 0.01 264);
  --neutral-800: oklch(0.25 0.01 264);
  --neutral-900: oklch(0.16 0.01 264);
}
```

## Dark Mode Rules

Dark mode is **not** inverted light mode:

| Aspect  | Light Mode                   | Dark Mode                                            |
| ------- | ---------------------------- | ---------------------------------------------------- |
| Depth   | Shadows create elevation     | Lighter surfaces create elevation                    |
| Base    | `oklch(0.97+ …)`             | `oklch(0.15-0.18 …)` — NOT pure black                |
| Accents | Full saturation              | Desaturate 10-20% to reduce glare                    |
| Text    | Dark on light, high contrast | Light on dark, slightly reduced contrast for comfort |
| Borders | Darker than surface          | Lighter than surface                                 |

```css
/* Dark surface elevation via lightness, not shadows */
--surface-0: oklch(0.15 0.01 264); /* Base */
--surface-1: oklch(0.18 0.01 264); /* Cards */
--surface-2: oklch(0.22 0.01 264); /* Modals */
--surface-3: oklch(0.26 0.01 264); /* Tooltips */
```

## 60-30-10 Rule

Applied to **visual weight**, not pixel count:

- 60% dominant (background, surface colors)
- 30% secondary (text, icons, subtle accents)
- 10% accent (CTAs, highlights, active states)

Accent works _because_ it's rare — overuse kills its power.

## Common Mistakes

- **Alpha as palette**: Heavy `rgba()` / transparency means incomplete palette — define explicit overlay colors per context
- **Gray text on colored background**: Use a darker shade of the background color or apply the text color at reduced opacity
- **Same accent everywhere**: If everything is "primary blue," nothing stands out
- **Ignoring contrast in dark mode**: WCAG 4.5:1 for body text, 3:1 for large text and UI components

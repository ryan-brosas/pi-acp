---
name: industrial-brutalist-ui
description: 'Use when the user requests brutalist, military-terminal, or raw mechanical aesthetics instead of design-taste-frontend, for data-heavy dashboards or editorial sites.'
disable-model-invocation: true
---

# Industrial / Brutalist UI

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Mono is the default.** JetBrains Mono / Berkeley Mono for everything.
- **Hard edges, no rounding.** `border-radius: 0`.
- **Hairline borders, dense grids.** 1px black on white. Tight cells.
- **Functional color only.** Status, warning, data category. Never decorative.
- **System chrome exposed.** File paths, IDs, timestamps, state. Information is the design.
</EXTREMELY-IMPORTANT>

## When to Use

User requests "brutalist", "terminal", "monospace", "raw", "declassified", "blueprint"; data-heavy dashboards; developer tools; security / ops; editorial gravitas; "1980s military terminal".

## When NOT to Use

Consumer / lifestyle; image-heavy; e-commerce; user wants warmth/elegance; "approachable" matters.

## Typography

```css
:root {
  --font-mono: 'JetBrains Mono', 'Berkeley Mono', 'IBM Plex Mono', monospace;
  --font-sans: 'Inter', -apple-system, system-ui; /* minimal use */
  --font-serif: 'IBM Plex Serif', Georgia; /* editorial accent */
}

body {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.4;
  letter-spacing: 0.02em;
  text-transform: uppercase; /* optional — for headers/labels */
}
```

Mono for everything. Sans for nothing. Serif for editorial accent.

## Color (Utilitarian)

```css
:root {
  --bg: #f5f5f0; /* paper / off-white */
  --fg: #0a0a0a; /* near-black */
  --border: #0a0a0a; /* black borders */
  --muted: #707070; /* gray */
  --data-1: #1a1a1a; /* near-black */
  --data-2: #c44d3a; /* brick red */
  --data-3: #3a6b3a; /* forest green */
  --warn: #c4a02a; /* amber */
  --error: #8b1a1a; /* deep red */
}
```

NO gradients, NO shadows, NO bright accents. Color is information, not decoration.

## Borders (Heavy / Hairline)

```css
.border-default {
  border: 1px solid #0a0a0a;
}
.border-thick {
  border: 2px solid #0a0a0a;
}
.border-quad {
  border-top: 1px solid #0a0a0a;
  border-bottom: 1px solid #0a0a0a;
}
```

Black on white. Always. Or white on black. The border is the design.

## Tables (Dense)

```tsx
<table className="w-full font-mono text-xs border-collapse">
  <thead>
    <tr className="border-b-2 border-fg">
      <th className="text-left py-1 px-2 uppercase">ID</th>
      <th className="text-left py-1 px-2 uppercase">Status</th>
      <th className="text-right py-1 px-2 uppercase">Value</th>
    </tr>
  </thead>
  <tbody>
    {rows.map(r => (
      <tr
        key={r.id}
        className="border-b border-fg"
      >
        <td className="py-1 px-2">{r.id}</td>
        <td className="py-1 px-2 uppercase">{r.status}</td>
        <td className="py-1 px-2 text-right tabular-nums">{r.value}</td>
      </tr>
    ))}
  </tbody>
</table>
```

Tight rows, mono, no zebra, hairline borders. Tabular numbers.

## Buttons (Raw)

```tsx
<button className="px-3 py-1 border border-fg font-mono text-xs uppercase tracking-wider hover:bg-fg hover:text-bg">
  EXECUTE
</button>
```

Square corners. Mono. Uppercase. The button says what it does.

## Status Indicators

```tsx
<span className="text-data-3 uppercase">[OK]</span>
<span className="text-warn uppercase">[WARN]</span>
<span className="text-error uppercase">[ERR]</span>
```

Brackets. Mono. Uppercase. Information only.

## System Chrome (expose it)

- File paths: `/var/log/system.log`
- Timestamps: `2026-07-04T12:34:56Z`
- IDs: `[req-abc123]`
- State: `STATE: ACTIVE`
- Counts: `3/247 tasks complete`

Information is the design. Hide it and the design loses its character.

## Common Mistakes

Rounded corners; gradients; shadows; "playful" decoration; "premium" feel; warm colors; image backgrounds; sans-serif body; "make it approachable"; colorful status indicators; tailwind defaults without overriding.

## Red Flags

`border-radius: 0.5rem`; `box-shadow: 0 4px 6px`; warm colors; sans for body; "approachable" copy; emoji; `gap: 16px` between rows (use 0); "premium" feel; "make it look modern".

## Anti-Patterns

**Rounded corners**; **gradients**; **shadows**; **warm colors**; **sans for body**; **emoji**; **"approachable"**; **smooth transitions**; **"premium"**; **"modern"**.

# Motion Core (motion/react)

**Import**: `import { motion, AnimatePresence } from 'motion/react'`

## Motion Principles

- Animate for clarity, not decoration
- Use motion to explain state change and hierarchy
- Prefer subtle distance (`8-16px`) and opacity shifts
- Use consistent timing/easing system across the app

## Timing System

| Use Case                      | Duration   |
| ----------------------------- | ---------- |
| Instant feedback (hover/tap)  | 100-150ms  |
| State changes (menus/toggles) | 200-300ms  |
| Layout transitions            | 300-500ms  |
| Large entrances               | 500-800ms  |

**Rule**: exit duration = ~75% of enter duration.

## Easing System

Use exponential easing by default:

```tsx
const EASING_ENTER = [0.16, 1, 0.3, 1];
const EASING_EXIT = [0.4, 0, 1, 1];
```

Avoid bounce/elastic easings for product UI.

## Performance Rules

Animate only compositor-friendly properties:

- `transform`
- `opacity`

Avoid animating:

- `width`, `height`
- `top`, `left`
- `margin`, `padding`

## Basic Pattern

```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
/>
```

## Variants Pattern (Recommended)

```tsx
const card = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

<motion.div variants={card} initial="hidden" animate="visible" />
```

Use variants for shared timing and maintainability.

## Exit Animations (AnimatePresence)

```tsx
<AnimatePresence mode="wait">
  {open && (
    <motion.div
      key="panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 1, 1] }}
    />
  )}
</AnimatePresence>
```

Always provide stable `key` values for exiting elements.

## Stagger Patterns

```tsx
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};
```

Cap total stagger windows to ~500ms.

## Layout Animations

```tsx
<motion.div layout />
```

Use `layout` for reordering and size changes. Add spring only when needed:

```tsx
<motion.div layout transition={{ type: 'spring', stiffness: 320, damping: 28 }} />
```

## Gestures

```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.12 }}
/>
```

Keep gesture amplitudes subtle (`0.98-1.03`).

## Height Expand/Collapse (No height animation)

Use CSS grid technique:

```css
.accordion-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.accordion-content[data-open='true'] {
  grid-template-rows: 1fr;
}

.accordion-inner {
  overflow: hidden;
}
```

## Reduced Motion (Mandatory)

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

For motion/react, switch spatial movement to opacity-only when reduced motion is enabled.

## Quick Checklist

- [ ] Uses `motion/react` import
- [ ] Timing follows 100/300/500ms system
- [ ] Exponential easing, no bounce/elastic
- [ ] Animates only `transform` and `opacity`
- [ ] Uses `AnimatePresence` for exit states
- [ ] Includes reduced motion support
- [ ] Stagger windows stay under 500ms

---
name: frontend-design
description: 'Use when building any web UI with React-based frameworks - components, pages, or full applications. Covers Tailwind CSS v4, shadcn/ui, and Motion animations; combine with an aesthetic overlay for a specific style.'
disable-model-invocation: true
---

# Frontend Design (React + Tailwind + shadcn)

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Server components by default.** `"use client"` only for state, effects, browser APIs.
- **Composition over configuration.** Children, render props, slots. Not 10 props.
- **Tailwind for styling, not for design.** The system; `design-taste-frontend` defines the look.
- **shadcn/ui primitives.** Don't reinvent Button, Dialog, Select. Copy, customize.
- **No CSS-in-JS for new code.** Tailwind or CSS modules.
</EXTREMELY-IMPORTANT>

## When to Use

Building any React/Next.js UI; new component/page/app; "I need a form/modal/table"; Tailwind v4 setup; shadcn/ui install.

## When NOT to Use

Server-rendered HTML (no React); simple static; non-Tailwind; "just a button" (copy shadcn).

## Component Anatomy

```tsx
// Server component (default in Next.js App Router)
export function UserCard({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{user.email}</p>
      </CardContent>
    </Card>
  )
}
```

Server components: no state, no effects, no browser APIs. Just data + JSX. Fast, small, cacheable.

## Client Components (When Needed)

```tsx
'use client' // required at top
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

Use `"use client"` for: `useState`, `useEffect`, event handlers, browser APIs, `localStorage`, `IntersectionObserver`. Boundary as small as possible.

## shadcn/ui

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

This adds to `components/ui/`. You own the code. Customize freely. Don't add what you won't customize — copy and edit.

Common: Button, Card, Dialog, Input, Select, Form, Table, Tabs, Toast, Tooltip, Sheet, DropdownMenu, Avatar, Badge, Calendar, Checkbox, Command, Popover, RadioGroup, ScrollArea, Separator, Slider, Switch, Textarea.

## Tailwind v4 (key changes from v3)

```css
/* globals.css */
@import 'tailwindcss';

@theme {
  --color-brand: oklch(0.7 0.15 240);
  --font-sans: 'Inter', system-ui;
}
```

No more `tailwind.config.js` for most cases. Use `@theme` in CSS. v4 uses Lightning CSS, ~10x faster.

## Motion (animations)

```tsx
import { motion } from 'motion/react'

;<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
/>
```

Use for entrances, exits, layout transitions. Not for every interaction. Respect `prefers-reduced-motion`.

## Forms

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

const form = useForm({
  resolver: zodResolver(Schema),
  defaultValues: { ... }
})
```

React Hook Form + Zod = typed forms with validation. Use shadcn's `<Form>` for boilerplate.

## Data Fetching

- **Server**: `async function`, `await fetch`, return JSX. Caching defaults are version-dependent (Next.js App Router changed defaults); verify the app's cache/revalidation settings.
- **Client**: `useSWR`, `useQuery`, or React Suspense. Loading, error, revalidation.
- **Mutations**: Server Actions (Next.js) or API routes. Optimistic with `useOptimistic`.

## Common Mistakes

`"use client"` everywhere; custom Button; `useEffect` for derived state; prop drilling; `localStorage` in server components; `Math.random()` in render; no loading/error; CSS-in-JS.

## Red Flags

`"use client"` everywhere; custom Button; `useEffect` for derived state; prop drilling 4+; `localStorage` in server; `Math.random()` in render; no error boundary; "memoize everything".

## Anti-Patterns

**`"use client"` everywhere**; **custom Button**; **`useEffect` for derived state**; **prop drilling**; **no loading/error**; **CSS-in-JS**; **"memoize later"**.

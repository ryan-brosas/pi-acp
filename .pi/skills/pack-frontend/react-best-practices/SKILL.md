---
name: react-best-practices
description: "Use when writing, reviewing, or refactoring React or Next.js code for performance - covers Vercel engineering patterns: components, data fetching, bundle optimization, server components."
disable-model-invocation: true
---


# React Best Practices

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Server components by default.** `"use client"` only when you need state, effects, or browser APIs.
- **Data fetching in the component that uses it.** Not in a parent, not in a store, not in a HoC. Co-locate fetch + render.
- **No `useEffect` for derived state.** Compute during render or use `useMemo`. `useEffect` is for synchronization.
- **Bundle size matters.** Tree-shake, code-split, defer. A button component is not 50KB.
- **Colocate by feature, not by role.** `features/auth/{LoginForm.tsx, useAuth.ts, auth.service.ts}`.
</EXTREMELY-IMPORTANT>

## Component Patterns

- Spread props: `<div {...props}>`. Prefer explicit props and forward refs.
- Named functions: `export function Button({ ... }: ButtonProps)`. Not anonymous arrow defaults.
- Ref forwarding: `forwardRef` only for library components. App code can use `useImperativeHandle` when needed.
- Compound components: `Select + Option` pattern for complex primitives.
- Render props / slots: pass `header`, `footer`, `children` instead of boolean flags.

## Server Components

```tsx
// Server component (default in App Router)
export async function UserPage({ params }: { params: { id: string } }) {
  const user = await db.findUser(params.id)
  return <UserCard user={user} />  // user is serializable, passes to client
}
```

No `useState`, no `useEffect`, no `useContext` (reading context is fine, setting is not). `async` component. Renders on server, sends HTML + minimal JS.

## Client Components

```tsx
"use client"
import { useState, useEffect } from "react"

export function UserMenu() {
  const [open, setOpen] = useState(false)
  // ...

  return <div>...</div>
}
```

Minimize the `"use client"` boundary. Put the interactive part in a client wrapper, keep the data-fetching part in the server component.

## Data Fetching

```tsx
// Server: React Cache (fetch caching)
async function getData() {
  const data = await fetch("https://api.example.com/data")
  return data.json()
}

// Client: SWR / TanStack Query
const { data, error } = useSWR("/api/data", fetcher)
```

## Performance

- `React.memo` strategically (not everywhere).
- `useMemo` / `useCallback` for referential equality, not for "optimization".
- `lazy` + `Suspense` for code-splitting.
- Profile with React DevTools before optimizing.
- Avoid inline handlers that break `React.memo`.

## Common Mistakes

`"use client"` everywhere; `useEffect` for derived state; prop drilling 5+ levels; no code-splitting; `React.memo` without measuring; inline handlers; `useCallback` everywhere; importing the whole library instead of the module; `useEffect` + `setState` pattern; async in `useEffect` without cleanup; not using `Suspense` boundaries.

## Red Flags

`"use client"` at top of every file; `useEffect` for state; prop drilling 5+; no code-split; `React.memo` everywhere (measure first); inline handlers; `import { everything }`; `useEffect` + `setState`; `async` in `useEffect` without cleanup; missing `Suspense`; bundle > 200KB per page.

## Anti-Patterns

**`"use client"` everywhere**; **`useEffect` for derived**; **prop drilling**; **no code-split**; **`React.memo` everywhere**; **`useCallback` everywhere**; **whole-library import**; **`useEffect` + `setState`**; **no `Suspense`**.

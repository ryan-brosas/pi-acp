# Interaction Design

## The 8 Interactive States

Every interactive element must design for ALL of these:

| State    | When                  | Visual Treatment                              |
| -------- | --------------------- | --------------------------------------------- |
| Default  | Resting               | Base appearance                               |
| Hover    | Cursor over (desktop) | Subtle shift — color, shadow, or translate    |
| Focus    | Keyboard navigation   | `:focus-visible` ring (NOT `:focus`)          |
| Active   | Being pressed/clicked | Compressed/depressed feedback                 |
| Disabled | Not available         | Reduced opacity (0.5) + `cursor: not-allowed` |
| Loading  | Processing            | Spinner or skeleton, disable interaction      |
| Error    | Validation failed     | Red border + error message below              |
| Success  | Action completed      | Green confirmation, brief                     |

## Focus Management

```css
/* Remove default focus for mouse, show for keyboard */
:focus:not(:focus-visible) {
  outline: none;
}
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

**Focus ring rules:**

- 2-3px thick
- Offset from element edge
- 3:1 minimum contrast against adjacent colors
- Consistent style across ALL interactive elements

## Native Dialog + Inert

Use `<dialog>` with the `inert` attribute — eliminates complex focus-trapping JS:

```html
<dialog id="modal">
  <form method="dialog">
    <h2>Confirm action</h2>
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>

<main id="content">…</main>

<script>
  const modal = document.getElementById("modal");
  modal.showModal();
  document.getElementById("content").inert = true;
</script>
```

## Popover API

For tooltips, dropdowns, and popovers — light-dismiss, proper stacking, accessible by default:

```html
<button popovertarget="menu">Options</button>
<div id="menu" popover>
  <button>Edit</button>
  <button>Delete</button>
</div>
```

No z-index wars. No portal wrappers. Built-in light dismiss.

## Form Validation Timing

- **Validate on blur**, not on keystroke (exception: password strength meters)
- Show errors below the field, not in toast/alert
- Inline validation: red border + message appears when field loses focus and is invalid
- Clear error when user starts correcting

## Loading Patterns

| Pattern          | Use When                          | Why                                    |
| ---------------- | --------------------------------- | -------------------------------------- |
| Skeleton screens | Page/component loading            | Previews content shape, feels faster   |
| Inline spinner   | Button action processing          | Keeps context, shows progress          |
| Progress bar     | Known duration (upload, download) | Sets expectations                      |
| Optimistic UI    | Low-stakes actions (like, toggle) | Update immediately, sync in background |

**Avoid**: Full-page spinners, blocking modals for non-destructive actions.

## Undo Over Confirmation

Users click through confirmation dialogs mindlessly. Prefer undo:

```
[ ] "Are you sure you want to delete?" → [Cancel] [Delete]
[x] Item deleted. [Undo] (5 second window)
```

Exception: irreversible actions with severe consequences (account deletion, payment).

## Touch Target Expansion

Visual size can be small; tap target must be 44x44px minimum:

```css
.icon-button {
  width: 24px;
  height: 24px;
  position: relative;
}

.icon-button::before {
  content: "";
  position: absolute;
  inset: -10px; /* Expands tap area to 44x44 */
}
```

## Scroll Behavior

```css
html {
  scroll-behavior: smooth;
  scroll-padding-top: 80px; /* Account for sticky header */
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

## Z-Index Scale

Named semantic layers prevent z-index wars:

```css
@theme {
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-modal-backdrop: 30;
  --z-modal: 40;
  --z-toast: 50;
  --z-tooltip: 60;
}
```

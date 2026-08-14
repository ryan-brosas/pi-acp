---
name: accessibility-audit
description: Use when auditing UI components or pages for accessibility compliance, checking WCAG conformance, identifying keyboard navigation issues, color contrast problems, and pre-launch accessibility verification
disable-model-invocation: true
---

# Accessibility Audit

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Keyboard = primary UX.** If a feature isn't keyboard-accessible, it doesn't exist for some users.
- **Color contrast ≥ 4.5:1 for body text.** No exceptions. Use the WebAIM contrast checker.
- **All interactive elements need focus states.** `:focus-visible` is the standard.
- **Forms need labels.** `<input>` without `<label>` is an a11y failure. Always.
- **Screen reader testing is not optional.** `aria-label` helps but doesn't replace real testing.
</EXTREMELY-IMPORTANT>

## When to Use

Pre-launch audit; checking WCAG conformance; keyboard nav issues; color contrast problems; IMAGE/button missing alt text; form validation; dynamic content updates.

## WCAG Basics

| Level | What                                                    |
| ----- | ------------------------------------------------------- |
| A     | Minimum. Keyboard access, alt text, captions.           |
| AA    | Standard. Color contrast ≥ 4.5:1, error identification. |
| AAA   | Advanced. Enhanced contrast, sign language.             |

Target AA for most projects. A is for emergencies.

## Common Issues and Fixes

| Issue               | WCAG  | Fix                                          |
| ------------------- | ----- | -------------------------------------------- |
| No alt text         | 1.1.1 | `alt="description"` or `role="presentation"` |
| Low contrast        | 1.4.3 | Adjust colors, ≥ 4.5:1 body, ≥ 3:1 large     |
| Keyboard trap       | 2.1.2 | Allow focus to exit (Tab, Escape)            |
| Missing labels      | 3.3.2 | `<label for="input">`                        |
| Focus state missing | 2.4.7 | `:focus-visible` on all interactive          |
| Live region missing | 4.1.3 | `aria-live="polite"` for dynamic content     |
| Error not announced | 4.1.3 | `role="alert"` or `aria-errormessage`        |
| Skip nav missing    | 2.4.1 | Skip link to main content                    |

## Audit Workflow

1. **Keyboard audit.** Tab through every interactive element. Can you navigate all of it?
2. **Contrast audit.** Grab colors, check against spec. Fix violators.
3. **Screen reader audit.** VoiceOver (macOS) or NVDA (Windows). Can you use the app?
4. **Focus audit.** Every button, link, input needs a visible `:focus-visible` state.
5. **Label audit.** Every input has a label. Every button has text or `aria-label`.
6. **Dynamic content audit.** Alerts, notifications, loading states have `aria-live`.

## Common Mistakes

Color contrast checked manually (use a checker); alt text on decorative images (use `role="presentation"`); `aria-label` everywhere (use proper html); keyboard-only mode ignored; missing focus states; "I'll fix a11y later" (do it now); testing only desktop (test mobile); "the validator passed" (automated check catches < 30% of issues); screen reader testing skipped; "it's a component library, it's accessible" (verify); dynamic content without live regions.

## Red Flags

No keyboard audit; `<div onClick={...}>` without `role="button"` + `tabindex`; missing `:focus-visible`; `aria-label="..."` without proper html; "a11y later"; no screen reader test; contrast < 4.5:1; forms without labels; dynamic content without live regions; skip nav missing; "the tool said it's fine" (automated misses real issues).

## Anti-Patterns

**No keyboard audit**; **no contrast check**; **`div` for buttons**; **missing focus**; **"a11y later"**; **no screen reader**; **low contrast**; **unlabeled forms**; **no live regions**; **skip nav missing**; **"automated pass = done"**.

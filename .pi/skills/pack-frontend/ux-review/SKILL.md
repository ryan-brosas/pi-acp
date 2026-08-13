---
name: ux-review
description: "Use when reviewing an existing interface for user-goal, flow, interaction-state, microcopy, accessibility, and responsive evidence before changing or shipping it."
disable-model-invocation: true
license: MIT
metadata: '{"source":"sickn33/antigravity-awesome-skills","commit":"75c558b","adapted_from":"design-thinking,ui-review,mobile-design,screen-reader-testing,ux-copy"}'
---

# UX Review: goal, flow, state, mobile, assistive, copy

## When to Use

Use when reviewing an existing interface before changing or shipping, when
the question is "does this work for a user" rather than "does it look good" or
"does it pass a compliance audit". The pack-frontend router loads this leaf for
review tasks needing user-goal, flow, interaction-state, microcopy,
accessibility, and responsive evidence.

## When NOT to use

- Visual quality and taste only -> design-taste-frontend
- Design tokens, component states, spec divergence -> design-system-audit
- WCAG compliance (contrast, labels, ARIA) -> accessibility-audit
- Building new UI -> frontend-design
- App journeys and seams -> app-experience-mapping
- Black-box experience review -> black-box-experience-review

## Review sequence

### 1. User goal

- State the primary user goal for each screen in one sentence. If you cannot
  name it, the review fails: an interface without a nameable goal cannot be
  reviewed for flow.
- Record the entry point and the expected outcome.

### 2. Critical path flow

- Walk the main task end to end: entry, action, feedback, completion.
- Count the steps and the decisions per step. More than one decision per step
  is a flow smell.
- Verify the next action is discoverable at every step and the previous
  outcome is visible before the next step starts.
- Never change information architecture, user flows, or copy during a review.
  Report findings; do not redesign.

### 3. Interaction states

- Every interactive element needs observable feedback: hover, active, disabled,
  focus, loading, success, error, empty.
- Errors never rely on color alone: pair with icon and text.
- Loading must not cause layout shift; success must not be silent.
- A missing state is a finding with evidence: name the control, the state,
  and where the user lands.

### 4. Mobile and narrow viewport

- Narrow the viewport to 360px. Horizontal overflow is a mandatory failure:
  scroll the page and record every element wider than the viewport.
- Touch targets at least 44x44px with spacing between targets.
- Text at least 12px; safe-area insets handled on notched devices.
- Mobile is not a small desktop: verify the primary action is reachable
  without pinching or reflowing.

### 5. Assistive technology

- Keyboard: complete the critical path with Tab, Enter, Space alone. Focus
  must be visible and in document order; no focus traps.
- Screen reader: announce the flow in order; errors announced with
  role="alert" or aria-errormessage. See accessibility-audit for the full
  WCAG pass.
- Forms: every input has an associated label; the error names the field and
  the fix.

### 6. Microcopy

- Name the action in the button. Never "Submit".
- Errors help instead of blame and never expose technical errors.
- Empty states invite the next action.
- One voice across the flow: casual but polite.
- Copy suggestions belong in the report, not in the reviewed interface.

## Evidence-based verdict

Score: Pass, Needs Improvement, or Fail. Every finding is a claim with
evidence: where (screen, control, step), what (behavior or missing state),
evidence (console, screenshot, tab order, viewport width, screen-reader
output, exact copy), why (which user is blocked, how).

A single mandatory failure fails the review: unnameable goal, broken critical
path, silent or missing state, horizontal overflow, unreachable keyboard
flow, unannounced error, or technical error text shown to users.

Needs Improvement requires a named list of prioritized fixes. Pass means every
claim is verified and no mandatory failure exists.

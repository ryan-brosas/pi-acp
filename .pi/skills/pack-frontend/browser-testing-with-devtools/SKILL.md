---
name: browser-testing-with-devtools
description: 'Use when verifying or debugging browser behavior with live runtime evidence: DOM state, console errors, network requests, screenshots, performance traces, or end-to-end user flows. Routes between Chrome DevTools and Playwright.'
disable-model-invocation: true
---

# Browser Testing with DevTools

## Overview

Browser testing proves what users actually experience. Use runtime evidence instead of assuming UI code works from static inspection.

## When to Use

- Building, debugging, or reviewing anything that runs in a browser.
- Validating forms, navigation, responsive layout, accessibility-visible state, or screenshots.
- Investigating console errors, network failures, hydration issues, or performance regressions.
- Reproducing bugs that only appear in a real browser runtime.

## When NOT to Use

- Pure backend or CLI-only changes.
- Unit-level logic that is faster and clearer to test without a browser.

## Tool Routing

| Need                                                    | Use                     |
| ------------------------------------------------------- | ----------------------- |
| Cross-browser automation, screenshots, repeatable flows | `playwright`            |
| Live Chrome inspection, console/network/runtime state   | `chrome-devtools`       |
| Bot-protected docs or static page extraction            | plain `fetch` or `curl` |
| UI implementation guidance                              | `frontend-design`       |

## Process

1. Define the user-visible behavior to prove.
2. Start the app or identify the target URL.
3. Choose the lightest browser tool that can produce evidence.
4. Capture initial state: page URL, screenshot or DOM snapshot, console/network baseline if relevant.
5. Exercise the user flow with stable selectors or accessible labels.
6. Capture final evidence: screenshot, DOM state, response status, console output, or trace.
7. If a bug appears, hand off to `debugging-and-error-recovery` with reproduction steps.
8. Record exact commands/tool actions and observed result.

## Common Rationalizations

| Rationalization                                   | Rebuttal                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| "The component compiles, so the browser is fine." | Runtime integration, CSS, hydration, and network behavior fail outside compilation. |
| "A screenshot is enough."                         | Screenshots miss console errors, failed requests, and inaccessible states.          |
| "Manual clicking is faster."                      | Repeatable scripted flows create evidence and prevent regression.                   |
| "The test is flaky, just wait longer."            | Use condition-based waiting and prove the actual state changed.                     |

## Red Flags

- No browser evidence for UI behavior changes.
- Ignored console errors or failed network requests.
- Arbitrary sleeps instead of waiting for conditions.
- Screenshots captured before animations/data loading settle.
- Selectors coupled to fragile layout instead of accessible names or stable IDs.

## Verification

Before declaring browser work complete, provide:

- URL or local command used.
- Browser tool used and why.
- Screenshots, traces, console/network output, or test result.
- Any untested browsers/devices and residual risk.

## Skill Result Contract

```xml
<skill_result>
  <skill>browser-testing-with-devtools</skill>
  <status>completed|blocked|skipped</status>
  <artifacts>Screenshot, trace, test file, console/network log, or none</artifacts>
  <evidence>Commands/tool actions and observed browser result</evidence>
  <risks>Untested browsers, flaky state, missing app server, or none</risks>
</skill_result>
```

---
name: playwright
description: "Use when running automated browser tests, taking screenshots, validating forms, or verifying UX flows. Playwright CLI for token efficiency with MCP fallback for complex exploration; also covers the agent-browser CLI alternative."
disable-model-invocation: true
---


# Playwright (Automated Browser Testing)

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Test user behavior, not implementation.** "User clicks Submit" not "Form posts to /api/save".
- **Locators by role / label / text, not CSS.** `[data-testid]` is a fallback, not a default.
- **Wait for the user-visible state, not the network.** `expect(page).toHaveText(...)` not `page.waitForResponse`.
- **One test = one user intent.** Don't chain unrelated assertions.
- **Stable tests, not exhaustive tests.** Cover the 5 critical flows, not the 50 edge cases.
</EXTREMELY-IMPORTANT>

## CLI-First (Token Efficiency)

```bash
# Install once
npx playwright install

# Run a single test
npx playwright test tests/login.spec.ts

# Run with specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug

# Show report
npx playwright show-report
```

Prefer CLI over MCP for token efficiency. Use MCP only for: complex exploration, error screenshots, or when the test environment is too dynamic to script.

## Locator Strategy

```ts
// PREFERRED: by role (semantic, accessible)
await page.getByRole("button", { name: "Submit" }).click()
await page.getByLabel("Email").fill("user@example.com")
await page.getByText("Welcome").toBeVisible()

// OK: by test id (when role isn't available)
await page.getByTestId("submit-button").click()

// AVOID: CSS selectors (brittle)
await page.locator(".btn.btn-primary.submit").click() // NO
```

## Wait Strategy

```ts
// GOOD: wait for user-visible state
await expect(page.getByText("Order confirmed")).toBeVisible()

// GOOD: wait for navigation
await page.getByRole("link", { name: "Dashboard" }).click()
await expect(page).toHaveURL(/\/dashboard/)

// BAD: arbitrary timeout
await page.waitForTimeout(2000) // NO

// BAD: wait for network (race conditions)
await page.waitForResponse("**/api/save") // NO
```

## Test Anatomy

```ts
import { test, expect } from "@playwright/test"

test("user can submit a form", async ({ page }) => {
  // Arrange
  await page.goto("/contact")
  // Act
  await page.getByLabel("Email").fill("user@example.com")
  await page.getByLabel("Message").fill("Hello")
  await page.getByRole("button", { name: "Send" }).click()
  // Assert
  await expect(page.getByText("Message sent")).toBeVisible()
})
```

AAA: Arrange, Act, Assert. One intent per test. Comments are not needed for the obvious.

## Screenshots

```ts
await page.screenshot({ path: "screenshot.png", fullPage: true })
```

Use for visual regression. Don't screenshot in every test — only when visual state matters.

## Common Mistakes

CSS locators (brittle); `waitForTimeout` (flaky); tests that depend on each other; "test everything" coverage; screenshotting in every test; testing implementation (form posts to /api/X); ignoring accessibility (use `getByRole`); retrying on failure instead of fixing the test; sharing state between tests; browser-specific selectors without fallback; long test files with no `describe` blocks.

## Red Flags

`page.waitForTimeout`; CSS selector chains; `page.locator(".x").nth(2)`; tests that pass in CI but fail locally (or vice versa); tests that depend on order; shared login state via cookies; "wait for response" assertions; flaky retries without root cause; no `test.describe` grouping; one file with 50+ tests; missing `await` on expect (silent pass).

## Anti-Patterns

**CSS selectors** (use role/label); **`waitForTimeout`** (wait for state); **testing implementation** (test user intent); **"test everything"** (5 critical flows); **shared state** (independent tests); **flaky retries** (fix the test).

---
name: browser-tools
description: Use when needing to interact with web pages, test frontends, or use a visible browser.
disable-model-invocation: true
---

# Browser Interaction

## When to Use

You need to visibly interact with a web page (not headless); click, type, scroll, read rendered content; test a frontend (not just API); take screenshots for review; debug flaky CI by reproducing locally; "show me the page" requests.

## When NOT to Use

Headless is sufficient (use Playwright); the task is API-level (use curl or fetch); no visual interaction needed (use a plain fetch or curl); static page that doesn't need JS execution.

## Capabilities

| Action           | Use                                      |
| ---------------- | ---------------------------------------- |
| Navigate to URL  | `page.goto(url)`                         |
| Get page content | `page.content()` — full HTML             |
| Screenshot       | `page.screenshot()`                      |
| Click element    | `page.click("[data-testid=...]")`        |
| Type into input  | `page.fill("[name=email]", "a@b.com")`   |
| Evaluate JS      | `page.evaluate(() => document.title)`    |
| Console logs     | `page.on("console", ...)` logs to output |
| Network requests | `page.on("request", ...)` — watch XHR    |

## Common Patterns

```python
# Python (playwright)
page = browser.new_page()
page.goto("https://example.com")
page.fill("input[name=email]", "user@example.com")
page.click("button[type=submit]")
page.wait_for_selector(".result")
content = page.content()
```

```javascript
// JavaScript (playwright)
await page.goto('https://example.com')
await page.fill('input[name=email]', 'user@example.com')
await page.click('button[type=submit]')
await page.waitForSelector('.result')
const content = await page.content()
```

## When to Fall Back

| Case                             | Fallback                                     |
| -------------------------------- | -------------------------------------------- |
| Page needs login                 | Use `page.goto` with pre-set cookies         |
| Page blocks non-proxied browsers | Use a plain fetch or curl for static content |
| Page is a heavy SPA (React, Vue) | Browser tool is the right choice             |
| Just need text                   | plain fetch is cheaper                       |
| Need to debug CSS                | Browser tool — screenshot is best            |

## Common Mistakes

`page.goto` without waiting (content not loaded); `screenshot` without visible layout; `click` on invisible element; `fill` before input is focused; not handling popups or new tabs; using browser for what Playwright CLI does faster; taking screenshots for text extraction; not closing the page (memory leaks).

## Red Flags

`page.goto` without `waitForSelector`; screenshot for text; browser for API tasks; not closing pages; ignoring console errors; "I'll just screenshot it" (use text extraction); using browser for static HTML (use plain fetch); too many tabs open at once.

## Anti-Patterns

**`goto` without wait**; **screenshot for text**; **browser for API**; **not closing pages**; **ignoring console errors**; **browser for static**; **too many tabs**.

# Anti-Patterns

## [ ] Don't: Fetch Entire Ecosystem

```bash
# Bad: Fetching everything
npx opensrc react
npx opensrc react-dom
npx opensrc react-router
npx opensrc react-query
# ... (too much code)
```

**Do:** Fetch only what you need to answer specific question.

## [ ] Don't: Read Random Files

```typescript
// Bad: Reading without purpose
read({ filePath: "opensrc/.../index.ts" });
read({ filePath: "opensrc/.../utils.ts" });
read({ filePath: "opensrc/.../helpers.ts" });
// ... (unfocused exploration)
```

**Do:** Use grep to find relevant code first, then read.

## [ ] Don't: Ignore Version Mismatch

```bash
# Bad: Fetching latest when project uses old version
npx opensrc zod  # Fetches 3.23.x
# But project uses zod@3.20.0 (different behavior)
```

**Do:** Specify version matching your lockfile, or let opensrc auto-detect.

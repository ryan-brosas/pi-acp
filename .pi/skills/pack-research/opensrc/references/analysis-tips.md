# Tips for Efficient Analysis

## 1. Start with Tests

Tests often show real-world usage better than docs:

```typescript
glob({ pattern: "opensrc/**/*.test.{ts,js}" });
read({ filePath: "opensrc/.../feature.test.ts" });
```

## 2. Check Examples Directory

Many repos have `examples/` or `samples/`:

```typescript
glob({ pattern: "opensrc/**/examples/**/*" });
```

## 3. Read CHANGELOG for Context

Understand recent changes:

```typescript
read({ filePath: "opensrc/.../CHANGELOG.md" });
```

## 4. Check TypeScript Definitions

Often more accurate than docs:

```typescript
glob({ pattern: "opensrc/**/*.d.ts" });
read({ filePath: "opensrc/.../index.d.ts" });
```

## 5. Use Blame for History (if needed)

```bash
cd opensrc/repos/github.com/owner/repo
git log --oneline -- src/file.ts
git show <commit>:src/file.ts
```

# Example: Complete Workflow

**Scenario:** Need to understand how zod handles async refinements.

```bash
# 1. Fetch source
npx opensrc zod
```

```typescript
// 2. Find refinement code
grep({
  pattern: "refine.*async",
  path: "opensrc/",
  include: "*.ts",
});

// 3. Locate implementation
ast_grep({
  pattern: "refine($$$) { $$$ }",
  path: "opensrc/repos/github.com/colinhacks/zod/",
});

// 4. Read the implementation
read({
  filePath: "opensrc/repos/github.com/colinhacks/zod/src/types.ts",
  offset: 500,
  limit: 100,
});

// 5. Check tests for usage examples
glob({
  pattern: "opensrc/**/zod/**/*.test.ts",
});

read({
  filePath: "opensrc/repos/.../async.test.ts",
});

// 6. Document findings
write({
  filePath: ".pi/work/<slug>/research.md",
  content: `# Zod Async Refinements

**Finding:** Async refinements use \`parseAsync()\` not \`parse()\`

**Evidence:** \`src/types.ts:842-856\`

Async refinements return Promise<Output> and require:
- Use \`.parseAsync()\` method
- Refinement function must return Promise<boolean>
- Errors handled via Promise rejection

**Code snippet:**
[paste relevant code]

**Recommendation:** Use \`.refine(async (val) => {...})\` with \`.parseAsync()\`
`,
});
```

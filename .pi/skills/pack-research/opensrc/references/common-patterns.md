# Common Patterns

## Pattern 1: Understanding Error Handling

```typescript
// 1. Fetch package
// bash: npx opensrc zod

// 2. Find error classes
grep({ pattern: "class.*Error", path: "opensrc/", include: "*.ts" });

// 3. Read error implementation
read({ filePath: "opensrc/repos/.../errors.ts" });

// 4. Find where errors are thrown
grep({ pattern: "throw new", path: "opensrc/", include: "*.ts" });
```

## Pattern 2: Tracing Function Behavior

```typescript
// 1. Fetch source
// bash: npx opensrc react-hook-form

// 2. Find function definition
grep({
  pattern: "export function useForm",
  path: "opensrc/",
  include: "*.ts",
});

// 3. Read implementation
read({ filePath: "opensrc/.../useForm.ts" });

// 4. Find dependencies
grep({ pattern: "import.*from", path: "opensrc/.../useForm.ts" });
```

## Pattern 3: Evaluating Library Quality

```typescript
// 1. Fetch source
// bash: npx opensrc candidate-library

// 2. Check test coverage
glob({ pattern: "opensrc/**/*.test.ts" });
glob({ pattern: "opensrc/**/*.spec.ts" });

// 3. Read tests for usage patterns
read({ filePath: "opensrc/.../feature.test.ts" });

// 4. Check for TypeScript usage
glob({ pattern: "opensrc/**/tsconfig.json" });

// 5. Review package.json for dependencies
read({ filePath: "opensrc/.../package.json" });
```

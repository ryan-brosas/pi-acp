---
name: deprecation-and-migration
description: Use when deprecating APIs, migrating between library versions, removing legacy code, or planning breaking changes — covers deprecation notices, migration guides, codemods, and staged rollout
disable-model-invocation: true
---

# Deprecation & Migration

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Deprecate first, remove later.** Users need time to migrate.
- **One major version per breaking change.** Don't bundle breaks.
- **Document the migration path.** "Deprecated" without "do this instead" is a wall, not a path.
- **Keep both working during deprecation.** Until the removal version.
- **Communicate in changelog, docs, runtime warnings.** All three.
</EXTREMELY-IMPORTANT>

## Deprecation Lifecycle

```
[1] Add @deprecated notice + runtime warning
[2] Document migration path (with codemod if possible)
[3] Wait at least one minor version (or 3 months, whichever longer)
[4] Remove in next major version
[5] Changelog: "Removed X. Use Y. Migration: <link>"
```

Skipping steps breaks trust. Users need time. The cadence is conservative on purpose.

## Deprecation Notice Template

```ts
/**
 * @deprecated since 2.3.0. Use `newApi()` instead.
 * Will be removed in 3.0.0.
 * Migration: https://docs.example.com/migration/2.3
 */
function oldApi() { ... }
```

In code: `@deprecated` JSDoc + runtime `console.warn` (rate-limited). In docs: a migration guide. In changelog: the same notice.

## Migration Guide Anatomy

```markdown
# Migrating from X to Y

## Why

[What changed and why.]

## TL;DR

[Smallest possible change.]

## Step-by-step

1. [First change. With code example.]
2. [...]

## Codemod

[Link to or inline a script that does the migration.]

## FAQ

[Common questions from the team or community.]
```

The TL;DR is for the impatient. The step-by-step is for the careful. The codemod is for the many.

## Codemod

A codemod script that automates the migration. Lives in `scripts/codemod/`. Tested on real code (not just samples).

```ts
// jscodeshift example
module.exports = (file, api) => {
  const j = api.jscodeshift
  return j(file.source)
    .find(j.CallExpression, { callee: { name: 'oldApi' } })
    .replaceWith(({ node }) => j.callExpression(j.identifier('newApi'), node.arguments))
    .toSource()
}
```

If you can't write a codemod, the migration is too complex for a deprecation. Reconsider.

## Staged Rollout

For breaking changes in libraries: feature flag the new behavior, default to old, opt-in for early adopters, default to new in next major.

```ts
function process(input) {
  if (featureFlags.newBehavior) return newProcess(input)
  return oldProcess(input) // deprecated path
}
```

## Common Mistakes

Removing without deprecation period; "deprecated" without a migration guide; bundling multiple breaks into one major; no runtime warning; no changelog entry; codemod that doesn't run on real code; guide that's only the TL;DR; deprecating without telling users; @deprecated JSDoc forever; "we removed it, use the new one" (no link).

## Red Flags

Removal without notice; `@deprecated` without runtime warning; no migration guide; codemod not tested; deprecation period < 1 minor version; "deprecated" not in changelog; multiple breaks in one major; asking users to read source for migration; no opt-in for early adopters; "we'll keep both forever" (that's a feature, not a migration).

## Anti-Patterns

**Remove without deprecating**; **deprecate without migration path**; **silent deprecation**; **codemod that breaks real code**; **bundled breaking changes**; **no changelog entry**; **"forever deprecated"** (commit to the timeline).

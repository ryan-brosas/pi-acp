---
name: fallow
description: "Use when analyzing code quality, finding dead code, detecting duplication, assessing complexity, checking blast radius, or cleaning up a TS or JS codebase with deterministic static analysis."
disable-model-invocation: true
---


# Fallow — Codebase Intelligence

Deterministic static analysis for TS/JS. Answers: dead code, duplication, complexity, architecture drift, (optionally) runtime behavior. **Does not generate code** — provides evidence.

**Always `--format json`** for structured output.

## When to Use

- **Before cleanup**: find unused files, exports, deps
- **Before refactor**: complexity hotspots + targets
- **Before editing**: blast radius via `fallow audit`
- **After generation**: verify no dead code or new duplication
- **When reviewing**: did the change land on a hot path?

## When NOT to Use

Non-TS/JS (Fallow is JS/TS only); one-line edits (overhead); runtime data without the runtime layer set up.

## Core Commands

```bash
# Dead code: unused exports, files, deps
fallow dead-code --format json

# Duplication: similar code blocks
fallow dupes --format json

# Health: complexity, size, blast radius per file
fallow health --format json

# Audit: change impact
fallow audit --changed-since main --format json

# Combined run (dead code + duplication + complexity)
fallow --format json
```

## Interpreting Output

```json
{
  "dead": {
    "files": ["src/legacy/foo.ts"],
    "exports": [{" file": "...", "name": "bar", "used": false }],
    "deps": ["lodash.debounce"]
  },
  "dupes": {
    "blocks": [{" files": ["a.ts", "b.ts"], "lines": 12, "hash": "..." }]
  },
  "health": {
    "files": [{
      "path": "src/services/user.ts",
      "complexity": 23,        // high
      "blast": 47,            // files affected
      "lines": 312
    }]
  }
}
```

Read the JSON. Cite the files and line counts. Don't paraphrase — the numbers are the evidence.

## Workflow

1. **Baseline first.** Run `fallow health` before changes. Save the JSON.
2. **Make your change.**
3. **Re-run.** Compare new JSON to baseline. Did complexity go up? New dead code? New dupes?
4. **Clean up.** If new dead code, delete. If new dupes, extract. If complexity spike, split.
5. **Verify.** Run typecheck + tests + the diff didn't grow unrelated changes.

## Common Mistakes

Reading summary without JSON (loses precision); running fallow but not acting on output; treating "low dead code %" as the goal (the goal is fewer bugs); not setting baseline; "delete this unused export" without checking who imports it (might be a public API); running on a 5k LOC project and trying to clean everything at once.

## Red Flags

"Code quality" claim without Fallow output; Fallow ignored because "we know it's bad"; dead code deleted without checking consumers; "we'll clean up later" (later never comes); no baseline = no diff = no signal; running once and never again; treating fallow output as a checklist instead of evidence.

## Anti-Patterns

**"I know it's bad"** (run Fallow); **"small project, no need"** (even small projects have dead code); **"delete all dead"** (check public API first); **"summary is enough"** (JSON is the contract); **"fallow said so"** (Fallow is evidence, not authority — use judgment).

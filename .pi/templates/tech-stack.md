---
purpose: Detected tech stack, commands, constraints, integrations, environments, and unknowns for AI context injection
updated: 2026-08-09
---

# Tech Stack

This file records the detected tech stack; read it on demand for project
context. Distinguish project dependencies from host tools: a host tool becomes a
stack entry only when a manifest, script, workflow, or explicit user decision
uses it. Every value carries version or command evidence.

## Framework & Language

- **Framework:** [e.g., Next.js 15, React 19] — Evidence: [manifest, file:line]
- **Language:** [e.g., TypeScript, strict mode] — Evidence: [config, file:line]
- **Runtime:** [e.g., Node.js 22, Bun 1.x] — Evidence: [engines or tool version]
- **Project manifest:** [package.json / pyproject.toml / Cargo.toml / go.mod / none] — Evidence: [path]

## Project Dependencies vs Host Tools

- **Project dependencies:** [packages the repository actually uses, with versions] — Evidence: [manifest]
- **Host tools (installed, not project dependencies):** list tools found in the
  environment with versions. They become dependencies only when a project file
  uses them.
  | Tool | Version | Evidence | Used by the project? |
  | --- | --- | --- | --- |
  | [tool] | [version] | [probe output] | [yes/no + where] |

## Styling & UI

- **CSS:** [e.g., Tailwind CSS v4] — Evidence: [config]
- **Components:** [e.g., shadcn/ui, Radix Primitives] — Evidence: [path]
- **Design System:** [e.g., tokens in tailwind.config.ts] — Evidence: [path]
- If no UI exists, state "None".

## Data & State

- **Database:** [e.g., PostgreSQL via Supabase] — Evidence: [config]
- **ORM:** [e.g., Drizzle, Prisma] — Evidence: [manifest]
- **State Management:** [e.g., Zustand, React Query] — Evidence: [path]
- **API Style:** [e.g., REST, tRPC, GraphQL] — Evidence: [routes]
- If no data layer exists, state "None".

## Commands

Verify each command before recording it. A command that does not exist is
recorded as "none" with the probe result.

| Command            | Status         | Purpose   | Verified          |
| ------------------ | -------------- | --------- | ----------------- |
| [install]          | [works / none] | [purpose] | [date, exit code] |
| [test]             | [works / none] | [purpose] | [date, exit code] |
| [lint]             | [works / none] | [purpose] | [date, exit code] |
| [typecheck]        | [works / none] | [purpose] | [date, exit code] |
| [build]            | [works / none] | [purpose] | [date, exit code] |
| [format]           | [works / none] | [purpose] | [date, exit code] |
| [validation gates] | [works / none] | [purpose] | [date, exit code] |

## CI

- **Workflows:** [.github/workflows/*.yml job list, or none] — Evidence: [path]
- **Local reproduction:** [command that mirrors CI, or none]

## Generated Files

- [output dir/file] is generated from [generator]. Never edit output by hand.
- Regenerate with: [command] — Verify with: [command]
- If nothing is generated, state "None".

## Testing

- **Unit Tests:** [e.g., Vitest] — Evidence: [config]
- **E2E Tests:** [e.g., Playwright] — Evidence: [config]
- **Coverage Target:** [e.g., 80%] — Evidence: [config]
- **Coverage gaps:** [known untested areas]

## Active Integrations

- [Service 1: e.g., Stripe for payments] — Evidence: [config or docs]
- [Service 2: e.g., Resend for email] — Evidence: [config]
- [Service 3: e.g., Sentry for error tracking] — Evidence: [config]
- If none exist, state "None".

## Environments

- [dev / staging / production / none]: [how each is configured and verified]
- [Rollback path, if any]

## Key Constraints

- [Constraint 1: e.g., Must work offline]
- [Constraint 2: e.g., WCAG 2.1 AA compliance required]
- [Constraint 3: e.g., No package install step for consumers]

## Unknowns

Facts not yet verified; ask the user rather than guessing.

- [e.g., Minimum supported runtime version: [NEEDS CLARIFICATION: reason]]

## Context Budget Guidelines

**Quality Degradation Rule:** Target ~50% context per plan execution for consistent quality.

| Task Complexity | Max Tasks/Plan | Typical Context Usage |
| --------------- | -------------- | --------------------- |
| Simple (CRUD)   | 3              | ~30-45%               |
| Complex (auth)  | 2              | ~40-50%               |
| Very complex    | 1-2            | ~30-50%               |

**Split Signals:**

- More than 3 tasks → Create child plans
- Multiple subsystems → Separate plans
- > 5 file modifications per task → Split
- Discovery + implementation → Split

## Verification Commands

**Always run before claiming complete:**

```bash
# Type checking
[typecheck command, or "none"]

# Linting
[lint command, or "none"]

# Testing
[test command, or "none"]

# Building
[build command, or "none"]

# Validation gates
[gate commands, verified]
```

---

_Update this file when tech stack or constraints change._
_AI will capture architecture, conventions, and gotchas in `.pi/MEMORY.md` as it works._

---
name: shell-development
description: "Use when writing or reviewing shell scripts - defensive Bash, error handling, ShellCheck, and Bats testing."
disable-model-invocation: true
---

# Shell Development

## Use when

Writing or reviewing shell scripts, CI pipeline steps, or system automation.

## Do not use when

Multi-file application logic; a real language is more testable.

## Key rules

- `set -euo pipefail` at the top of every script.
- Quote every variable expansion; never parse `ls` output.
- `trap` for cleanup on exit; remove temp files and restore state.
- Check for required commands and fail with a clear message.
- Use `$(...)` over backticks; prefer `[[ ]]` over `[ ]` in Bash.
- Fail fast with explicit exit codes; every branch has an outcome.
- ShellCheck in CI; fix every finding.
- Test with Bats; cover success, failure, and cleanup paths.
- Keep scripts short; extract functions for logic worth testing.

## Red flags

Unquoted variables; no `set -e`; silent failures; rm -rf on unvalidated paths; scripts longer than one screen doing real logic.

## Skill Result Contract

```xml
<skill_result>
  <skill>shell-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Script structure, error handling, shellcheck results, bats tests</evidence>
  <artifacts>Scripts and test suite</artifacts>
  <risks>Unsafe rm, unquoted expansion, or none</risks>
</skill_result>
```

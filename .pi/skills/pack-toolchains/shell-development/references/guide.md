# Shell Development Guide

Source: adapted from agents `plugins/shell-scripting/skills/bash-defensive-patterns/SKILL.md` (local CGC reference).

## Strict mode

```bash
set -euo pipefail
IFS=$'\n\t'
```

- `-e` stops on errors, `-u` catches unset variables, `-o pipefail` catches pipeline failures.
- Restore `IFS` deliberately; the default space splitting causes bugs.

## Quoting and expansion

- Quote every expansion: `"$var"`, `"$@"` for arguments.
- Use `$(...)` over backticks; prefer `[[ ]]` over `[ ]` in Bash.
- Never parse `ls`; use globs or `find -print0`.

## Error handling

- `trap 'cleanup' EXIT` for temp files and state restoration.
- Check required commands: `command -v foo || die "foo is required"`.
- Exit with distinct codes; print errors to stderr.

## Safety

- `rm -rf` only on validated paths: assert the variable is non-empty and absolute.
- Never eval user input; avoid `xargs` without `-0` on filenames.

## Testing

- ShellCheck in CI; fix every finding.
- Bats for behavior tests: success, failure, and cleanup paths.
- Keep functions small; anything worth real logic deserves a language with types.

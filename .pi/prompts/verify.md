---
description: Verify the current work against the spec and gates before claiming completion
argument-hint: "[--full|--no-cache|--quick]"
---

# Verify: $ARGUMENTS

Verify the current work against the spec and the project gates, and report readiness.
> **Workflow:** `/ship` → **`/verify`**

## Read-only

This command is read-only: it runs gates, checks completeness, and reports. It never edits code.

## Parse Arguments

| Argument | Default | Description |
| --- | --- | --- |
| `--full` | false | Bypass the cache and run fresh (no incremental mode exists) |
| `--no-cache` | false | Bypass the verification cache |
| `--quick` | false | Skip the Phase 4 coherence cross-check |

## Phase 0: Check Verification Cache

If a recent verification is still valid (same commit + diff fingerprint), report a cached PASS and skip to Phase 2.

```bash
CURRENT_STAMP=$(printf '%s\n%s\n%s' "$(git rev-parse HEAD)" "$(git diff HEAD)" "$(git ls-files --others --exclude-standard | xargs cat 2>/dev/null)" | shasum -a 256 | cut -d' ' -f1)
LAST_STAMP=$(tail -1 .pi/work/$(cat .pi/work/.active)/.verify.log 2>/dev/null | awk '{print $1}')
# Optional: cross-check the cached stamp via state.get('verification_stamp') instead of the dotfile tail.
```

| Condition | Action |
| --- | --- |
| `--no-cache` or `--full` | Skip cache check, run fresh |
| `CURRENT_STAMP == LAST_STAMP` | Report cached PASS, skip to Phase 2 |
| otherwise | Run gates normally |

## Phase 1: Gather Context

Read `.pi/work/$(cat .pi/work/.active)/spec.md` to understand the requirements.

**Verify guards:**
- [ ] Plan/spec exists and is up to date
- [ ] You have read the full spec

## Phase 2: Completeness Matrix

Extract all requirements/tasks from the PRD and verify each is implemented:
- For each requirement, find evidence in the codebase (file:line reference)
- Mark as: complete, partial, or missing
- Report completeness score (X/Y requirements met)

Do not flag a requirement as missing without searching for its implementation first.

## Phase 3: Correctness

Follow the verification protocol: `.pi/skills/verification-before-completion/references/VERIFICATION_PROTOCOL.md`.

**Default:** run the canonical gate in full. This repository's gate has no incremental mode; `--full`/`--no-cache` only bypass the verification cache.

**Execution order:** run the canonical gate `node scripts/check.mjs` (always full). This repository has no install, typecheck, lint, test, build, or format commands; the canonical gate is the verified completion check.

For browser/manual local-web requirements, use stable URLs as verification evidence. A reachable URL supplements, but never replaces, the canonical gate evidence.

Report results with a mode column:
```text
| Gate                     | Status | Mode | Time   |
|--------------------------|--------|------|--------|
| Skill packs + manifest   | PASS   | full | 0.5s   |
| Router probes            | PASS   | full | 0.4s   |
| Pi Fabric contract    | PASS   | full | 0.3s   |
| Work management          | PASS   | full | 0.3s   |
| Notion workspace         | PASS   | full | 0.4s   |
| Release hygiene          | PASS   | full | 0.2s   |
| git diff --check         | PASS   | full | 0.1s   |
| Build     | SKIP   | —           | —      |
```

**Inspecting output matters:** "0 tests run", "all skipped", and "compiled with warnings" are not passes. Read the exit code and the output tail.

**After all gates pass**, record to the verification cache:
```bash
echo "$CURRENT_STAMP $(date -u +%Y-%m-%dT%H:%M:%SZ) PASS" >> .pi/work/$(cat .pi/work/.active)/.verify.log
```

Then write the durable result to `.pi/work/$(cat .pi/work/.active)/verification.md`
(the gate table with mode column plus the READY TO SHIP / NEEDS WORK / BLOCKED
result). Writing `verification.md` is a mutation: it requires the Schema loop
(`schema.hypothesize → verify → commit`) before the write.

## Phase 4: Coherence (skip with --quick)

Cross-reference artifacts for contradictions:
- PRD vs implementation (does code address all PRD requirements?)
- Plan vs implementation (did code follow the plan?)
- Research recommendations vs actual approach (if different, is it justified?)

Flag contradictions with specific file references.

## Phase 5: Local vs Live

Separate what was verified locally from what still needs confirmation on live servers:
- Name the servers and flags that must be checked before deployment.
- A local pass does not imply a live pass; label unverified claims as unconfirmed.

## Phase 6: Report (output contract)

Append to `.pi/work/$(cat .pi/work/.active)/.progress.md`: `Verification: [PASS|PARTIAL|FAIL] - [summary]`.

Output:
1. **Result**: READY TO SHIP / NEEDS WORK / BLOCKED
2. **Completeness**: score and status
3. **Correctness**: gate results (with mode column)
4. **Coherence**: contradictions found (if not --quick)
5. **Local vs live**: what is verified locally, what must be checked on a server
6. **Blocking issues** to fix before shipping
7. **Next step**: `/ship $ARGUMENTS` if ready, or list fixes needed

Record significant findings in context files:
```bash
# Append to .pi/MEMORY.md:
#   - YYYY-MM-DD: [scope] [key finding] — [what, impact, resolution]
# Put under the Decisions or Gotchas section as appropriate
```

## Schema boundary

Running gates is read-only. Appending to `.pi/work/$(cat .pi/work/.active)/.verify.log` and
`.pi/work/<id>/.progress.md` is local state and allowed without a
Schema commit. Writing `.pi/work/<id>/verification.md` is a durable mutation and
requires its own Schema loop (`schema.hypothesize → verify → commit`) before
the write. Any remediation also requires the Schema loop (or explicit user
approval when the guard is off) before edits. After verification, record the gate decision (passed/disposition; evidence kinds: command, artifact, trace, custom) with the session's workflow recorder when available, or carry it in the completion report.

**Dual mode.** Read-only discovery is identical in both modes; only a durable
write branches by mode. Schema mode (`schema.status().mode === "enforce"`):
run `schema.hypothesize → verify → commit` in the same `fabric_exec` as the
write. Main-session mode (guard off or project untrusted): propose the
write to the user and apply only after explicit approval of the exact file and
content. Detect at the write boundary: `schema.status()` reports `enforce` →
Schema mode; otherwise → main-session mode.

## Related Commands

| Need | Command |
| --- | --- |
| Ship after verify | `/ship <id>` |
| Plan a feature | `/plan` |
| Fix a bug | `/fix` |

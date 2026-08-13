---
name: opensrc
description: "Use when you need to understand how a library works internally, debug dependency issues, or inspect package source beyond types and docs - fetches source for npm, PyPI, crates.io, and GitHub repos."
disable-model-invocation: true
---


# Open Source Code Investigation

## When to Use

Library behaves unexpectedly; need to understand how a function works internally; types/docs don't explain a behavior; debugging a dep issue; "is this safe to use?"; planning a migration; reverse-engineering a pattern.

## When NOT to Use

Good docs and types answer; behavior is standard and obvious; "I just want to use it" (debug with logging).

## Core Principle

**Read the source before forming an opinion about the library.** Types and docs lie. Source is the contract. When the docs say X and the code does Y, the code is right.

## Investigation Workflow

1. **State the question.** "How does X work?", "Why does Y happen?", "What is the actual behavior of Z?"
2. **Locate the source.** When the library exists as an inspo clone under `<inspo-root>/<repo>` (resolve `$INSPO_ROOT` or ask the user), query its CGC context first (`cgc find name/content ... --context "<inspo-root>/<repo>"`) and read source only through the indexed graph; never clone or grep the inspo tree. Otherwise use the GitHub repo, npm tarball, or the dep's `node_modules/<pkg>/`; the repo is usually the most readable.
3. **Read the README + docs first.** 30 seconds can save 30 minutes.
4. **Navigate the code.** Find the entry point. Follow the call graph for the specific behavior.
5. **Read the test file.** Tests document the intended behavior. Often clearer than the impl.
6. **Verify your understanding.** Write a tiny test that exercises the behavior. Did you predict the output?
7. **Note the version.** `git log` to see when the behavior was added / changed.

## Mutation Boundary

OpenSrc's first-use setup may edit `.gitignore`, `tsconfig.json`, and `AGENTS.md`, and `npx opensrc` adds an unreviewed package fetch. In this repository those are mutations: require the Schema loop (`schema.hypothesize → verify → commit`) or explicit user approval of the exact files before any write; prefer non-mutating modes/flags when available.

## Common Targets

| Question | Where |
|---|---|
| "How does X work?" | The function's source file |
| "Why is X slow?" | The function + callers + trace |
| "What is Y's behavior?" | Types + tests + source |
| "Is X safe?" | Audit (eval, exec, fs.write) |
| "When was X added?" | `git log` on the file |
| "Known bug?" | GitHub issues |

## Red Flags While Reading

`eval`, `new Function` in unexpected places; `child_process.exec` with user input; `fs.writeFile` with untrusted paths; network calls to hardcoded domains; hidden side effects in `import` / `require`; deps on packages that don't exist.

## Common Mistakes

Reading source without a question (drift); assuming docs are right (verify); reading old version (check `package.json`); not running code while reading; stuck in dep hell (find boundary); "I don't need to look" (until it breaks); "docs say X" without verifying.

## Red Flags

"I think it works like X" without reading; not checking the version; wrong package; not running a verification test; trusting README over code; "I don't need to read the source" (you do); "docs are out of date" (without checking); debugging without hypothesis.

## Anti-Patterns

**Trust the docs**; **skip the tests**; **read wrong version**; **read without a question**; **"I think it works"**; **drift into reading the whole codebase**.

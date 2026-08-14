---
name: source-driven-development
description: Use when using unfamiliar libraries, external APIs, framework behavior, or current ecosystem guidance and need to ground decisions in official docs, source code, and cited references.
disable-model-invocation: true
---


# Source-Driven Development

## Overview

Framework guesses become bugs. Source-driven work verifies behavior against authoritative references before implementation.

Core principle: cite the source for non-trivial external API decisions, or mark the decision as unverified.

## When to Use

- New or unfamiliar library/framework/API.
- Version-specific behavior matters.
- Choosing between packages or integration patterns.
- Error suggests external API misuse.
- User asks to research current best practice.

## When NOT to Use

- Pure local codebase questions; use code search/explore.
- Stable project conventions already cover the behavior.
- Trivial syntax you can verify from existing code.

## Source Hierarchy

1. Official docs, specs, release notes.
2. Maintained source code and examples.
3. Maintainer-authored articles.
4. Community posts only when higher sources are absent.

Higher-ranked sources win on conflicts.

## Workflow

1. State the question precisely.
2. Check memory/local docs for prior decisions.
3. Retrieve authoritative sources.
4. Verify version compatibility with the project.
5. Compare sources if guidance conflicts.
6. Extract only the implementation-relevant facts.
7. Cite URLs or source refs in the recommendation.
8. Mark unresolved uncertainty explicitly.

## Common Rationalizations

| Rationalization | Rebuttal |
| --- | --- |
| "I know this API" | APIs change; verify version-specific behavior. |
| "A blog said so" | Blogs lose to official docs/source. |
| "The package name is obvious" | Similar packages differ in security and maintenance. |
| "Citations slow us down" | A bad integration costs more than a source check. |

## Red Flags

- Unfamiliar API used without citation or local precedent.
- Community answer conflicts with official docs.
- Version in docs differs from package version.
- Agent invents options, flags, or imports.
- Research dump has no recommendation.

## Verification

- Key claims cite authoritative sources.
- Project/library versions are considered.
- Implementation recommendation is specific.
- Unverified assumptions are labeled.

## Skill Result Contract

```xml
<skill_result>
  <skill>source-driven-development</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Sources consulted and version checks</evidence>
  <artifacts>Research notes, citations, implementation recommendation</artifacts>
  <risks>Unverified claims, stale docs, conflicting sources, or none</risks>
</skill_result>
```


## Consolidated Research Workflow

This is the canonical active source-grounding skill. It absorbs deep-research and source-code-research for normal work. Use opensrc as the tool-specific companion only when the source demands it.

Evidence hierarchy:
1. local code and tests;
2. official docs and source;
3. maintained examples from reputable repos;
4. blog posts or issues with dates and caveats.


## Removed Optional Companion

`v1-run` was removed as an optional package-health skill. Use source-grounded package evaluation, official advisories, lockfile inspection, and package-manager audit commands instead.

## Pi Fabric Boundaries

**Discovery** — Pi Fovea for local code, then authoritative sources. **Verification** — direct behavioral probes for external claims.

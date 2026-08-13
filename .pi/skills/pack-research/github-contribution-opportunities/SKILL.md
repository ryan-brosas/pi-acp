---
name: github-contribution-opportunities
description: "Use when finding and qualifying legitimate GitHub pull-request contribution opportunities in open-source repositories before claiming or implementing work."
disable-model-invocation: true
---

# GitHub Contribution Opportunities

## Core Principle

Optimize for useful merged work, not counts. Discovery is read-only. Never comment, request assignment, fork, branch, push, or open a PR without approval for that exact action.

## Workflow

### 1. Define the search

Capture languages, domains, effort limit, minimum activity, star range, and known repositories first. Prefer repositories the user uses or contributed to. Use one evidence route per question; inspect one candidate deeply before expanding.

### 2. Discover candidates

Search active repositories and issues. Favor confirmed bugs, missing regression tests, behavior-backed docs, reproductions, help-wanted work, and explicit maintainer requests. Reject empty commits, typo farming, generated-noise changes, automated issue spam, dependency churn, policy evasion, duplicate fixes, and unsolicited refactors.

### 3. Read repository policy

Before ranking, inspect README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, LICENSE, issue forms, PR template, CI, branches, generated-file rules, commit convention, CLA/DCO, test commands. Missing or conflicting policy is an unknown, never an assumption.

### 4. Check collisions and ownership

For each issue, inspect assignee, claim comments, linked and draft PRs, duplicate issues, recent commits, release branches, and superseding maintainer work. Confirm the issue remains wanted. A label alone is not permission.

### 5. Measure maintainer and merge signals

Record recent commits/releases, maintainer replies, review latency, stale discussions, merged external contributors, and first-time-contributor review. Report observations with dates; do not turn sparse history into a probability claim.

### 6. Prove feasibility

Confirm setup cost, local reproduction, affected paths, smallest testable change, test command, dependency knowledge, review burden, and realistic time. If reproduction or a named verification command is missing, disposition cannot be READY.

### 7. Keep identity facts separate

Verify only what the question needs: `gh auth status`; `gh api user`; `gh repo view OWNER/REPO`; `gh pr view N --repo OWNER/REPO`; commit API metadata; and local `git config --show-origin --get-regexp '^user\.(name|email)$'`. Repository owner, fork owner, PR author, commit metadata, GitHub commit association, and local config are separate facts. Commit metadata never proves account ownership or PR attribution.

### 8. Score and decide

Score 0-5: value 20%, feasibility 20%, maintainer signal 15%, merge evidence 15%, learning value 10%; minus review cost 5%, collision 5%, attribution 5%, spam 5%. Show raw evidence and weighted total. Stars are context, not value.

Disposition:
- **READY**: wanted, collision-free, reproducible, bounded, verifiable.
- **ASK FIRST**: valuable but scope, ownership, or maintainer intent is unclear.
- **WATCH**: healthy repository with no safe task now.
- **SKIP**: stale, duplicate, prohibited, oversized, unverifiable, or low-value.

## Output

| Rank | Repository | Stars | Opportunity | Evidence | Effort | Merge signal | Risks | Score | Disposition |
| --- | --- | ---: | --- | --- | --- | --- | --- | ---: | --- |

For the top candidate include policy, collision, reproduction, files/tests, identity facts, unknowns, and the smallest approved next action. Draft any maintainer comment; do not send it.

## Stop Conditions

Stop after one READY candidate, three fully qualified candidates, or two evidence gaps on one candidate. Cap discovery at five repositories and ten issues unless the user expands it. Stop on license conflict, security-sensitive work, active competing PR, or maintainer rejection.

## Evidence Record

For every claim: claim, source tool, exact call, URL or context, date, confidence. No source, no claim.

<skill_result>
  <skill>github-contribution-opportunities</skill>
  <status>success|partial|blocked|failure</status>
  <evidence>Sources, dates, commands, ranked candidates, top-candidate dossier</evidence>
  <artifacts>Evidence table and optional unsent maintainer-comment draft</artifacts>
  <risks>Collisions, attribution, policy gaps, spam risk, or none</risks>
  <next_action>One read-only step or one exact mutation awaiting approval</next_action>
</skill_result>

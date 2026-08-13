---
name: app-experience-mapping
description: "Use when mapping an app's user journeys, touchpoints, channels, and service seams before building, shipping, or changing it, to define hypotheses and measurable outcomes."
disable-model-invocation: true
license: MIT
metadata: '{"source":"synthesis; close adaptation: browserbase/skills ui-test (MIT) and antigravity-awesome-skills (MIT, commit 75c558b); concepts only: infrasity-labs/dev-gtm-claude-skills journey-map/experience-map/service-blueprint (license unverified, discovery evidence)","adapted_from":"browserbase/skills ui-test, antigravity product-manager-toolkit, customer-research, onboarding-cro, api-onboarding, design-thinking, ux-copy"}'
---

# App Experience Mapping

## When to Use

Use when planning an app build, change, or launch and the team needs to see the
whole experience before writing code: who the user is, what they are trying to
do, which touchpoints and channels they cross, and where the app hands work to
another system.

## When NOT to use

- Executing the review itself -> black-box-experience-review
- Screen-level UI review -> ux-review
- Visual styling or design tokens -> design-taste-frontend / design-system-audit

## Black-box input contract

Treat the app as a black box. Inputs: the app name and platform, the primary
user and their goal, the channels used (web, mobile, desktop, CLI, API,
notifications, email), the entry point, and the expected outcome. Do not read
implementation details to build the map; read product intent and observed
behavior.

## Journey map schema

For each primary journey produce a table: stage, user action, touchpoint,
channel, what the user feels, pain points, and opportunity. Stages run from
entry through first success to repeat use. Mark every cell as hypothesis (H)
or observed (O). Unmarked cells default to hypothesis and must not be reported
as fact.

## Experience map schema

Map the full ecosystem: every touchpoint and channel a user can reach, how
they connect, and where the same intent splits across channels (web start,
email resume, mobile finish). Highlight channel handoff points as seam
candidates.

## Service blueprint schema

For the service behind the app: frontstage actions the user sees, backstage
actions the app performs, and supporting systems (auth, payments, storage,
queues, email, notifications). At each step record the handoff: which system
owns the next step, what can fail, and what the user sees while waiting.

## Seam inventory

Inventory the boundary crossings the map exposes: authentication and
permissions, payments and billing, external OAuth, file pickers and uploads,
deep links and redirects, email and push notifications, background jobs,
support and feedback, account deletion and export, cross-device sync, offline
storage, and third-party embeds. For each seam name the two systems, the
failure modes, and the user-visible signal of success or failure.

## Research questions

Turn the map into questions: what does the user need at each stage, what
breaks the flow, what would make them abandon, and what recovery they expect
after each failure. Use the research pack's `evidence-router` methods (or describe the interview/survey/ticket-analysis approach directly)
for interviews, surveys, and ticket analysis.

## Outputs

Deliver the journey map, experience map, blueprint, seam inventory, and a
prioritized list of hypotheses. Label every output with its evidence status:
hypothesis, observed, or verified. Each hypothesis needs a measurable outcome
so the later review can test it.

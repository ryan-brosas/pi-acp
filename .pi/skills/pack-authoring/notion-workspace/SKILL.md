---
name: notion-workspace
description: "Use when the user needs to search, read, create, update, organize, or synchronize Notion pages and databases, or wants a central workspace or second brain in Notion. Prefer this over driving Notion in a browser."
disable-model-invocation: true
---

# Notion Workspace

## Core Principle

**Notion is the human dashboard, never the machine source of truth.** GitHub issues, pull requests, and milestones own code work identity. The local ryan-workspace repository owns registries, audits, clone state, and validation results. Notion records decisions, summaries, content, and flexible capture. Keep this split; do not copy machine state into Notion.

## Auth and First Moves

1. Run `notion-cli auth status`. If unauthenticated, tell the user to run `notion-cli auth` themselves; never ask for or expose credentials. Credentials live at `~/.config/notion-cli/credentials.json`.
2. **Search before fetch, fetch before edit.** `notion-cli search <query>` finds pages and databases. `notion-cli fetch <page-url-or-id>` reads a page fully. Never write to a page you have not fetched in this task.
3. Reuse existing structure. If a Projects, Tasks, Notes, or Second Brain system already exists, link to it. Never create a duplicate system when the existing one fits.

## Single Central Hub

The top-level Second Brain is the single central hub and the only central dashboard. Maximize it; never create a parallel hub or dashboard when Second Brain exists. Add any missing sections directly to Second Brain instead of nesting a new hub under it. Keep sections for Projects, Tasks, Notes, Content, Learning, Ideas, Principles and Preferences, GitHub Work, Workspace Audits, Source of Truth, and Review Cadence. The hub links existing databases; it does not replace them. Capture freely, organize later. Promote captured ideas to Projects when they become real.

## Content System

Reuse Creator’s Companion as the content system. Content Ideas, Research & Swipes, Content Projects, Channels & Courses, and Wiki drive publishing. Capture raw material in Quick Capture and promote it into Creator’s Companion. Never create or retain a second content system when Creator’s Companion already exists.

## Editing

- Prefer `page edit` with `--find`/`--replace` for surgical text changes. Use `--find-file`/`--replace-file` for multiline sections and `--edits-file` for batches.
- Use `page update --content` only for deliberate full rewrites; it replaces the whole body and needs `--allow-deleting-content` when content is removed.
- Match sibling indentation: tab depth controls block nesting in Notion. Fetch the page first and match the tab depth at the insertion point.
- Create child pages with `page create --parent <id> --title "Title" --content "markdown"`.
- All commands return JSON. Pipe to `jq` for filtering.

## Safety

- Destructive operations such as `page remove-child` need explicit user approval first.
- Never expose tokens, cookies, credentials, or credential paths.
- Never delete or restructure an existing database without approval.
- When a request is ambiguous, fetch before guessing parents or database shape.

## Result Contract

After acting, report the page URL, what changed, and what still needs user action (for example browser approval for a new page or destructive removal).
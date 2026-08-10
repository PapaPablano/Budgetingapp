---
date: 2026-08-10
topic: zapier-mcp-budget-sync
---

# Agent-Driven Zapier Sync for Budget Data

## Problem Frame

Both budgeting tools (`index.html`, `allocator.html`) are fully static HTML/CSS/JS with no backend — all data lives in the browser's `localStorage` (`budgetPlanner-v1` and `goal-paycheck-planner-v1` respectively) and is entered manually. There is currently no way to get that data out of the browser at all: no export, no API, no accounts.

The user wants Claude Code to be able to back up their budget data to Google Sheets on request, using the Zapier MCP tools already connected to this session. Because Claude Code runs outside the browser, it cannot read `localStorage` directly — something has to bridge the data from the page to the agent before Zapier can act on it.

Flow: **page (localStorage) → Export button (JSON download) → user hands file to Claude Code → Claude uses Zapier MCP → Google Sheet**

This is agent-driven, not app-driven: Zapier is invoked by Claude during a session, not called from the browser itself. The web app gains only a small export affordance; no backend or webhook layer is added.

## Requirements

**Data Export (app changes)**
- R1. Add an "Export data" button to `index.html` that serializes its current `localStorage` state (`budgetPlanner-v1`) to a downloaded JSON file.
- R2. Add an "Export data" button to `allocator.html` that serializes its current `localStorage` state (`goal-paycheck-planner-v1`) to a downloaded JSON file.
- R3. Export is manual/on-demand only — no automatic export, no background sync, and no change to how data is entered or stored day to day.

**Zapier Sync (agent-driven)**
- R4. When the user provides an exported file (or asks within a Claude Code session), Claude uses Zapier MCP's Google Sheets actions to write the data into one persistent Google Sheet, with each page's data in its own tab (e.g. "Cash Flow Planner", "Paycheck Allocator").
- R5. Each sync overwrites/replaces the destination tab's contents with the current export — the sheet reflects only the most recent sync, not a running history.
- R6. Sync is triggered by explicit user request only (e.g. "sync my budget to Sheets") — never scheduled or automatic.

## Success Criteria
- The user can export both pages' current data and have Claude push it into a Google Sheet within one conversational request.
- Re-running a sync produces a clean, current snapshot with no duplicate or stale rows left behind.
- Neither page's existing manual-entry, `localStorage`-first workflow changes in any way.

## Scope Boundaries
- No new backend/server component — both pages remain static HTML/CSS/JS with `localStorage`, consistent with the existing project pattern.
- Sync is one-way (browser → Sheet) only; no import or read-back into either page.
- No scheduled or automatic syncing — always user-initiated, per explicit decision during this brainstorm.
- No bank/transaction import — unchanged from the existing scope boundary already set for the goal-based planner.
- No historical/versioned snapshots — only a current-state overwrite, not an append-only log.
- No other Zapier automations (Slack/email notifications, calendar reminders) in this pass — noted as possible future directions, not built here.

## Key Decisions
- **Agent-driven, not app-driven**: Zapier runs from Claude Code sessions rather than being called from the browser, so no backend/webhook layer needs to be added to a currently backend-free app.
- **Export button as the data bridge**: since Claude cannot read `localStorage`, a simple downloadable JSON export is the lowest-friction way to hand data to Claude, and is reusable for any future agent-driven automation, not just this one.
- **Overwrite, not append**: the sheet always shows current state rather than accumulating historical snapshots — simplest to reason about as a backup/analysis destination.
- **Both pages in scope**: `index.html` and `allocator.html` have independent data models; each gets its own export button and its own tab in the destination sheet.
- **On-demand only**: no scheduling infrastructure is introduced; matches the app's existing manual, no-accounts philosophy rather than adding a new always-on dependency.

## Dependencies / Assumptions
- Verified during this brainstorm: Zapier MCP has a Google Sheets integration available (7 read / 21 write actions) but it is **not yet enabled or connected** to a Google account in this session — enabling the action and authenticating the connection is a one-time setup step required before first use.
- Assumes the user has, or will create, a Google Sheet to serve as the sync destination.

## Outstanding Questions

### Deferred to Planning
- [Affects R4, R5][Technical] Whether Zapier's Google Sheets action set includes any bulk clear/range-delete action, or only single-row create/update — this determines whether R5's "overwrite" is achievable directly or needs a clear-then-write sequence (or the sandboxed code-execution path), and what happens if that sequence fails partway (left cleared-but-incomplete, no history to recover from per the no-versioning scope boundary).
- [Affects R4][Technical] R4's two trigger phrasings ("user provides an exported file" vs. "asks within a Claude Code session") aren't reconciled — define what happens if the user asks to sync without having exported first, and whether Claude reading a predictably-named export directly (Claude Code has local filesystem access) could remove the manual hand-off step entirely.
- [Affects Dependencies][Needs research] Confirm the Zapier-vs-alternatives tradeoff explicitly during planning: Zapier's Sheets connection requires the same one-time setup (enable + OAuth) regardless of whether Zapier or a simpler direct-write path is used, so the "already connected" rationale in the Problem Frame should be re-checked against that reality rather than assumed.
- [Affects R5][User decision, deferred] Whether overwrite-only sync (no history, no safeguard against syncing an empty/bad export) sufficiently serves the "backup" framing in Success Criteria, or whether a minimal safeguard (e.g., warn/block on a suspiciously empty export) is worth the added complexity.
- [Affects Zapier Sync][Needs research] Access-control and data handling for financial data leaving the browser: destination Sheet sharing/visibility defaults, Zapier/Google OAuth scope and credential lifecycle, whether the full data payload should sync or a minimized subset, and whether exported JSON files need retention/cleanup guidance since they land in plaintext on the local filesystem (e.g. Downloads).
- [Affects Zapier Sync][Technical] Whether destination tabs ("Cash Flow Planner", "Paycheck Allocator") must be pre-created by the user or can be created by the chosen Zapier action, and whether a lightweight post-sync verification step (e.g. row-count check) should confirm the write actually succeeded.
- [Affects R1, R2][Needs research] Exact JSON shape and filename convention for the exported files.
- [Affects R4][Technical] Sheet/tab layout and column mapping for each page's data (goals, bills, spending categories, entries, income, paydays for `allocator.html`; whatever `index.html`'s equivalent fields are).

## Next Steps
-> /ce:plan for structured implementation planning

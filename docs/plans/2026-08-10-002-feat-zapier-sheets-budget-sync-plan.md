---
title: Add data export + agent-driven Google Sheets sync via Zapier MCP
type: feat
status: active
date: 2026-08-10
origin: docs/brainstorms/2026-08-10-zapier-mcp-budget-sync-requirements.md
---

# Add Data Export + Agent-Driven Google Sheets Sync via Zapier MCP

## Overview

Add a small "Export data" button to each of the two static budgeting pages (`index.html`, `allocator.html`) that downloads the page's current `localStorage` state as JSON. Separately, define the procedure Claude follows — using the now-verified Zapier MCP Google Sheets actions — to push an exported file into a persistent Google Sheet on explicit user request. The app itself gains only the export affordance; the sync is performed by the agent during a session, not by any new backend code.

## Problem Frame

Both pages are fully static HTML/CSS/JS with no backend; all data lives in `localStorage` and there is currently no way to get it out of the browser. The user wants Claude Code to be able to back this data up to Google Sheets on request, using Zapier MCP. See origin document for full problem framing.

## Requirements Trace

- R1. `index.html` gets an Export data button producing a JSON download.
- R2. `allocator.html` gets an Export data button producing a JSON download.
- R3. Export is manual/on-demand only, no change to existing entry/persistence behavior.
- R4. Claude uses Zapier MCP's Google Sheets actions to write exported data into one persistent Sheet, one tab per page.
- R5. Each sync overwrites the destination tab's contents (current-state snapshot, not a history).
- R6. Sync is triggered by explicit user request only.

## Scope Boundaries

(Carried from origin document — see full list there.) No new backend/server component. One-way sync (browser → Sheet), no read-back into either page. No scheduled/automatic syncing. No bank/transaction import. No historical/versioned snapshots. No other Zapier automations (notifications, calendar reminders) in this pass.

## Context & Research

### Relevant Code and Patterns

- Both pages are fully independent, no shared JS/CSS, no build step, no `<script src>` includes — a new feature must be self-contained inline script in each file, duplicating logic rather than extracting a shared module (matches how `loadState`/`saveState` are already duplicated between the two files).
- `index.html`: `STORAGE_KEY = 'budgetPlanner-v1'` (index.html:298); state shape `{ month, income[], bills[] }` (index.html:327-333); event listeners wired individually at the bottom of the script via `getElementById(...).addEventListener(...)` (index.html:504-524). No toolbar/header action-button area exists yet — the header currently holds only `<h1>` + subtitle + cross-link (index.html:255-259).
- `allocator.html`: `STORAGE_KEY = 'goal-paycheck-planner-v1'` (allocator.html:399); state shape `{ paydays: {p1,p2}, goals[], bills[], categories[], months: {} }` (allocator.html:402-410); `<header class="page-header">` already holds an eyebrow, month-nav, and a cross-page link (allocator.html:328-336) — a natural place to add the Export button alongside the existing link. Action buttons use `.btn-add` (primary, color-modified) and `.btn-icon` (icon-only) classes (allocator.html:227-240, 686-690).
- No download-from-browser code exists anywhere in the repo (confirmed via grep for `Blob`, `createObjectURL`, `download=`) — this feature introduces that pattern for the first time; no local convention to follow beyond "vanilla JS, no dependencies."
- No `docs/solutions/` directory exists — no institutional learnings to draw on for this feature.
- No `AGENTS.md` exists. The repo's `CLAUDE.md` files only contain tool-routing instructions for the assistant, not app-code conventions — not material to this plan.

### External References

Inspected live against the connected Zapier MCP server's action schemas (not general documentation) during planning — this confirms the action and its parameters exist, not that an overwrite call has actually been executed against a real sheet yet (that's still gated on the OAuth step below, and is the first real-world test of this mechanism):
- Google Sheets is available via Zapier MCP (`GoogleSheetsV2CLIAPI`) and was enabled during this planning session (29 actions: 8 read, 21 write, including `create_spreadsheet`). The connection requires a one-time Google OAuth step (`needs_auth: true`) not yet completed — see Dependencies below.
- `create_worksheet` accepts `overwrite: true` plus a `headers` list and (re)creates a worksheet with that exact title, replacing any prior contents in one call. This is a genuine bulk-replace primitive — it resolves the review-flagged risk that Sheets actions are "row-based only" and removes the need for a fragile clear-then-write-N-rows sequence. Its actual replace behavior against a real sheet (e.g. one with unusual formatting or protected ranges) is still unconfirmed until Unit 3 first runs for real — see Risks.
- `add_row` / `add_row_lines` write one or more rows; `get_data_range` / `find_many_rows` read a tab back for verification.

## Key Technical Decisions

- **`create_worksheet(overwrite: true)` is the overwrite mechanism**: recreates the named tab from scratch in a single call per sync, satisfying R5's "current snapshot, no stale rows" without a multi-step clear-then-write sequence. Resolves the review's top finding that this mechanism was unverified.
- **Tabs are created on demand, not pre-required**: `create_worksheet` creates-or-replaces, so the user does not need to pre-create "Cash Flow Planner" / "Paycheck Allocator" tabs before first use.
- **Uniform row schema over per-entity columns**: each page has multiple entity types with different fields (goals, bills, categories, income, monthly entries). Rather than inventing a bespoke column layout per entity type, every synced tab uses one flat schema: `record_type | record_id | synced_at | fields_json`, where `fields_json` holds that record's actual fields as a JSON string. This keeps the sync logic uniform and robust to the two pages' differing (and potentially changing) data shapes, at the cost of the sheet being less immediately human-scannable than a fully flattened, entity-specific layout — an acceptable tradeoff for a backup/analysis destination, and revisitable later if needed.
- **Fixed base filenames, located by pattern + newest-modified-time, not exact match**: exports are still named `cashflow-planner-export.json` / `paycheck-allocator-export.json`, but the sync procedure looks for files matching that base name (including browser-auto-suffixed duplicates like `cashflow-planner-export (1).json`) and picks the most recently modified match. Plain "exact fixed filename" was reviewed and found unsafe: browsers do not overwrite same-named downloads by default, they auto-suffix them — so an exact-name lookup would silently find a stale first export instead of the latest one. Matching by pattern + recency keeps the predictability benefit (addressing R4's unreconciled trigger phrasings) without that failure mode.
- **Destination spreadsheet is confirmed with the user every sync, never silently reused**: rather than the agent trying to remember "the" spreadsheet across sessions — which has no defined storage mechanism and was flagged by three reviewers as unworkable as originally written — the agent always states which spreadsheet (name + URL) it's about to write to and gets explicit confirmation before the destructive `overwrite: true` call, whether that's a spreadsheet the user names, one mentioned earlier in the same session, or a newly created one. This is simpler than inventing a cross-session persistence mechanism, keeps the design portable (no dependency on any particular tool's memory features), and doubles as the fix for the security-review finding that a wrong-target overwrite had no confirmation step.
- **Export payload is a small versioned envelope**: `{ exportedAt, source, version: 1, data }`, where `data` is the page's existing state object as-is. Gives the sync step enough context (which page, when) without redesigning either page's internal state shape.
- **Full data payload synced, intentionally**: this is a single-user personal app: no field-level minimization is applied. (Resolves the review's data-minimization finding — the answer is "sync everything," not "figure out what to omit.")
- **No sharing changes to the destination Sheet**: it's created in the user's own Drive via the Zapier connection and stays private by default like any new Google Sheet — no extra access-control code or config needed. (Resolves the review's Sheet-access-control finding with an explicit "do nothing extra" decision rather than silence.)
- **Lightweight empty-export safeguard, agent-side**: before overwriting, the agent checks that the parsed export contains at least one non-empty entity (income, bill, goal, or category); if everything is empty, it confirms with the user before proceeding rather than silently overwriting a previously-good sync with a blank one.
- **Post-sync verification, agent-side**: after writing, the agent reads the tab back (`get_data_range` or `find_many_rows`) and compares the row count to what it expected to write, then reports success or a discrepancy to the user — rather than declaring success purely because the write calls didn't error.

## Open Questions

### Resolved During Planning

- Bulk-overwrite mechanism (blocking the whole R5 design): `create_worksheet(overwrite: true, headers: [...])`. See Key Technical Decisions.
- Destination-tab pre-existence: not required; `create_worksheet` creates or replaces.
- Sheet/tab column mapping: uniform `record_type | record_id | synced_at | fields_json` schema across both pages, including explicit handling of non-array top-level fields like `paydays` (see High-Level Technical Design).
- Export JSON shape and filename convention: versioned envelope, fixed base filenames located by pattern + newest-modified-time rather than exact match (see Key Technical Decisions — revised after review found exact-match unsafe against default browser download behavior).
- Empty/bad-export safeguard and post-sync verification: both resolved as lightweight agent-side steps (see Key Technical Decisions) rather than app code, since the sync itself is agent-driven.
- Cross-session destination-spreadsheet identity: resolved by never silently reusing one — the agent states and confirms the destination every sync instead (see Key Technical Decisions). This removed the need for any persistence mechanism, which document review found undefined in the original draft.
- `create_spreadsheet` availability: confirmed enabled among the 29 Zapier Sheets actions added during planning (see External References).

### Deferred to Implementation

- Whether `add_row_lines` accepts a batch of multiple rows in one call, or whether each record needs its own `add_row` call — the action's dynamic parameter schema wasn't fully resolved during planning; check `dynamic_properties_schema` against `inspect_zapier_actions` when first executing a real sync, and prefer the batch form if available.
- Exact default browser download location varies by OS/browser configuration — if the agent can't find a matching file in the common default location at sync time, it should ask the user for the path rather than guessing.
- Precise Google OAuth scope granted by the Zapier Google Sheets connection is determined by Zapier's own consent screen at auth time, not something this plan configures directly.
- Whether `create_worksheet(overwrite: true)` behaves as a clean full replace against a real spreadsheet with any unusual formatting/protection — first confirmed at the first live sync, verified via the Unit 3 step 6 read-back rather than assumed.

## High-Level Technical Design

> This illustrates the intended approach and is directional guidance for review, not implementation specification.

Flow: `page (localStorage)` → click Export → `Blob` + temporary `<a download>` → fixed-name JSON file on disk → user asks Claude to sync → Claude locates/reads the file → Claude calls Zapier MCP → `create_worksheet(overwrite: true, headers: [...])` on the target tab → per-record `add_row` calls → read-back verification → result reported to user.

Per-tab row schema (both pages, same shape):

| record_type | record_id | synced_at | fields_json |
|---|---|---|---|
| `meta` (index.html) | `"meta"` | ISO timestamp of this sync | the page's non-array top-level fields as-is, e.g. `{"month":"2026-08"}` |
| `paydays` (allocator.html) | `"paydays"` | same | the `paydays` object as-is, e.g. `{"p1":1,"p2":15}` — not omitted as "non-scalar" |
| `income` / `bill` / `goal` / `category` | the record's existing id | same | that record's other fields as JSON |
| `month` | the month key (`YYYY-MM`) | same | that month's income + entries sub-object as JSON |

Every page produces exactly one `meta`-or-`paydays` row; there is no ambiguity about whether non-array top-level fields (like `paydays`) are scalar enough to include — they're always included, serialized as-is.

## Implementation Units

- [ ] **Unit 1: Export button on `index.html`**

**Goal:** Let the user download the current `index.html` state as a JSON file.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `index.html`

**Approach:**
- Add an "Export data" button near the existing header (index.html:255-259), the only sensible slot since there's no existing toolbar.
- On click: build `{ exportedAt: <ISO timestamp>, source: 'index.html', version: 1, data: state }`, `JSON.stringify` it, create a `Blob` (`type: 'application/json'`), trigger a download via a temporary `<a download="cashflow-planner-export.json">` + `URL.createObjectURL`, then revoke the object URL.
- Wire the click handler alongside the other listeners at the bottom of the script (index.html:504-524), matching the existing style (no inline `onclick`, no framework).

**Patterns to follow:**
- Existing `getElementById(...).addEventListener('click', ...)` wiring at index.html:504-524.
- Existing `state` variable and `loadState()`/`saveState()` functions (index.html:335-368) — export reads `state`, does not mutate it.

**Test scenarios:**
- Happy path: with income and bills entered, click Export → downloaded file parses as valid JSON and its `data` field matches the current in-app state.
- Edge case: click Export with default/empty state (no income, no bills) → still downloads valid JSON with empty arrays, no error thrown.

**Verification:**
- Clicking the button downloads a correctly-named, valid JSON file whose `data` matches what's currently rendered on the page, in a real browser.

- [ ] **Unit 2: Export button on `allocator.html`**

**Goal:** Let the user download the current `allocator.html` state as a JSON file.

**Requirements:** R2, R3

**Dependencies:** None (independent of Unit 1 — separate file, separate state)

**Files:**
- Modify: `allocator.html`

**Approach:**
- Add an "Export data" button inside the existing `<header class="page-header">` (allocator.html:328-336), alongside the current cross-page link, using the existing `.nav-btn`/`.btn-icon` visual language rather than introducing a new button style.
- Same envelope/Blob/download mechanism as Unit 1, with `source: 'allocator.html'` and filename `paycheck-allocator-export.json`.
- Wire the click handler alongside the other listeners at the bottom of the script (allocator.html:915-930).

**Patterns to follow:**
- Existing header structure and button classes (allocator.html:227-240, 328-336, 686-690).
- Existing `state`, `loadState()`, `persist()` functions (allocator.html:402-470) — export reads `state`, does not mutate it.

**Test scenarios:**
- Happy path: with goals, bills, categories, income, and logged entries populated, click Export → downloaded file's `data` matches the full current state, including nested `months` entries.
- Edge case: click Export before any goals/bills/categories/income have been configured → still downloads valid JSON with empty collections, no error.

**Verification:**
- Clicking the button downloads a correctly-named, valid JSON file whose `data` matches the page's current state, in a real browser.

- [ ] **Unit 3: Zapier → Google Sheets sync procedure (agent-driven, no app code)**

**Goal:** Define exactly how Claude performs a sync when the user asks, so it's repeatable and consistent across sessions rather than improvised each time.

**Requirements:** R4, R5, R6

**Dependencies:** Units 1 and 2 (needs an exported file to act on); Google OAuth connection for the Zapier Google Sheets integration completed by the user (see Dependencies / Prerequisites) before this can run for real.

**Files:** None — this unit is a documented procedure the agent follows during a live session, not code shipped in the repo.

**Approach:**
1. On a request like "sync my budget to Sheets," search the common download location for files matching each page's export base name — including browser-auto-suffixed duplicates (`cashflow-planner-export.json`, `cashflow-planner-export (1).json`, etc.) — and select the one with the most recent modification time per page. If none match, ask the user for the path.
2. Parse the envelope for each file; if every top-level entity collection is empty, confirm with the user before proceeding rather than silently overwriting a prior good sync.
3. State the destination spreadsheet (name and URL) — a spreadsheet the user names, one already established earlier in the conversation, or a newly created one via `create_spreadsheet` — and get explicit confirmation before proceeding. Never silently reuse a spreadsheet from a prior session without the user confirming it in this one.
4. For each page's data, call `create_worksheet` with `overwrite: true`, the page's tab title ("Cash Flow Planner" / "Paycheck Allocator"), and `headers: ["record_type", "record_id", "synced_at", "fields_json"]` — this replaces the tab's prior contents in one call.
5. Write one row per record (batched via `add_row_lines` if it supports multiple rows in one call, otherwise sequential `add_row` calls) using the schema in High-Level Technical Design.
6. Read the tab back (`get_data_range` or `find_many_rows`) and compare the row count to the number of records written; report success with the row count, or report a discrepancy rather than assuming success.

**Test scenarios:**
- Happy path: export both pages with representative data, ask Claude to sync → both tabs are (re)created with one row per record, read-back row count matches, success reported with counts.
- Edge case: export the same page twice without deleting the first file (browser produces `export (1).json`) → Claude selects the most recently modified match, not the original, and syncs current data.
- Edge case: ask Claude to sync with an export where every collection is empty → Claude confirms with the user before overwriting rather than proceeding silently.
- Edge case: ask Claude to sync without having exported first / no matching file found → Claude asks the user for the file location instead of failing silently or guessing.
- Edge case: user has synced in a prior session → Claude still states the destination spreadsheet and gets confirmation this session rather than silently reusing it, since there's no cross-session persistence mechanism.
- Error path: a write call partway through the row sequence fails (e.g. rate limit) → read-back verification in step 6 surfaces the discrepancy to the user rather than reporting false success.

**Verification:**
- Running through the procedure once end-to-end against a real (or test) Google Sheet produces a tab per page whose row count matches the source export, with the agent explicitly confirming the count rather than assuming success.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `create_worksheet(overwrite: true)` may not behave as a clean full replace in every edge case (e.g. unusual sheet protections) — its schema was inspected during planning but not yet exercised against a real sheet | Unit 3 step 6 reads the tab back and reports a discrepancy instead of assuming success; first real sync is the first behavioral test of this mechanism |
| ~~Google OAuth for the Zapier Sheets connection isn't completed yet~~ Done (2026-08-10) | Connected as `epeterson0076@gmail.com`, set as default — see Dependencies/Prerequisites |
| Downloaded file may not land where Claude Code expects it (browser/OS-dependent download folder), and browsers auto-suffix repeat downloads of the same name rather than overwriting | Pattern + newest-modified-time lookup (Unit 3 step 1) handles auto-suffixed duplicates; falls back to asking the user for the path if nothing matches |
| No cross-session mechanism remembers which spreadsheet was used previously | Accepted by design: the agent always states and confirms the destination spreadsheet with the user each sync (Unit 3 step 3) instead of trying to persist that identity — also closes the "wrong-target destructive overwrite" gap the security review raised |
| Prompt injection from untrusted pasted content could in principle trigger an unintended sync | Accepted residual risk — sync always requires an explicit natural-language ask in a live session (R6); no autonomous/scheduled trigger exists in this design, matching the origin document's explicit scope boundary |
| Exported JSON contains full financial data in plaintext on local disk | Low severity for a personal single-user machine; out of scope to build tooling around, but worth a one-line UI hint near the Export button that the file is sensitive |
| Zapier's own infrastructure may log or retain the financial payloads passed through its Sheets actions, per Zapier's platform policies rather than anything this plan controls | Accepted trust boundary of choosing Zapier MCP as the sync mechanism (an explicit, prior user decision, not re-litigated here) |
| A future, unrelated Claude Code session has no automatic way to discover that this sync procedure exists (no `AGENTS.md`, Unit 3 ships no code) | Accepted for a personal single-user repo: the user re-shares this plan's path (or repeats the relevant context) when first invoking a sync in a new session; not worth building discovery tooling for this scope |
| `months` history in allocator.html grows over time, and every sync rewrites the full dataset rather than incrementally | Accepted: expected volume for a personal budget (well under a few hundred rows total across all entity types even after years of use) doesn't warrant incremental-sync complexity now |

## Dependencies / Prerequisites

- ~~The Zapier MCP Google Sheets connection (`GoogleSheetsV2CLIAPI`) was enabled during planning but still requires a one-time Google account OAuth step before Unit 3 can be exercised for real.~~ **Done (2026-08-10):** connected as `epeterson0076@gmail.com` and set as the default connection. Unit 3 can now be exercised for real; the `create_worksheet(overwrite: true)` behavioral confirmation noted in Risks & Dependencies is unblocked.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-08-10-zapier-mcp-budget-sync-requirements.md](docs/brainstorms/2026-08-10-zapier-mcp-budget-sync-requirements.md)
- Related code: `index.html:255-259,298,327-368,504-524`; `allocator.html:328-336,399-470,915-930`

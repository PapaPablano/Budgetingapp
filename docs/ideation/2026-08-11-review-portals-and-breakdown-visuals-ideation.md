---
date: 2026-08-11
topic: review-portals-and-breakdown-visuals
focus: the review portals and breakdown visuals
---

# Ideation: Review Portals & Breakdown Visuals

## Codebase Context

Static, dependency-free HTML/CSS/JS personal budgeting app (repo: `/Users/ericpeterson/Budgetingapp`) — no backend, no accounts, no build step, no test framework, all by deliberate design for a single-user personal tool.

Two pages, recently unified onto one shared `localStorage` key (`budget-v1`):
- `index.html` (Monthly Cash Flow Planner): now a pure read-only 3-card summary (total income, total bills, remaining) with positive/negative/awaiting states, reading `state.summary` which `allocator.html` computes and persists on every save.
- `allocator.html` (Paycheck Allocator): the sole editing workspace — bills (with due dates), two-paycheck income, savings/spending goals, variable-spending categories, logged entries, month navigation. Shows two per-paycheck verdict cards (income vs. bills vs. goals, funded/unfunded per goal shown as plain text lines) plus a month-total card.

`allocator.html` already tracks month-keyed history (`state.months{}`) for every month the user has ever navigated to — this data exists in storage even though nothing currently visualizes it across months. `computeMonthVerdict(monthKey)` already accepts any month key as a parameter.

**Zero data visualization exists anywhere in the app today** — no charts, graphs, trend lines, category breakdowns, or spending-composition visuals. Everything is plain text/numbers in cards and list rows.

A recently-shipped agent-driven Zapier→Google Sheets export (triggered by asking Claude Code to sync, not from the app UI) exists as an alternative "review elsewhere" path, but the focus hint asks for review in the app itself.

No `docs/solutions/` learnings exist yet to draw on for this focus area.

## Ranked Ideas

### 1. Goal progress bars/rings
**Description:** Replace the plain-text "SavingsGoal: $100.00 of $100.00" lines in the verdict cards with horizontal progress bars or rings, color-coded by funded/partial/unfunded state.
**Rationale:** Zero new computation — the funded/target numbers already exist per goal per paycheck via `computeCycleVerdict`. Pure rendering change with outsized perceived-polish payoff relative to effort.
**Downsides:** Small enough that it's easy to under-scope as not worth its own effort — best bundled with another idea rather than shipped completely alone.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 2. Month-over-month trend strip on index.html
**Description:** A small sparkline or bar-row on `index.html`, under the existing 3 summary cards, plotting total income, total bills, and/or remaining across the last 6-12 months from `state.months{}`.
**Rationale:** `state.months{}` already accumulates this data every time the user navigates — it's write-only today. This is the cheapest way to turn dead storage into a visual answering "am I getting better or worse over time?"
**Downsides:** Benefits from a shared charting primitive (idea #7) rather than a one-off SVG implementation.
**Confidence:** 85%
**Complexity:** Low-Medium
**Status:** Unexplored

### 3. Category spending breakdown chart
**Description:** A bar or donut chart (likely on `allocator.html` near the categories section, or on a new review surface) showing how variable-spending categories divide up money spent this month, built from logged entries.
**Rationale:** The most literal answer to "breakdown visuals" — there is currently zero visual representation of where money goes anywhere in the app.
**Downsides:** Needs new aggregation logic across logged entries by category that doesn't currently exist in that shape.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

### 4. Historical Review Mode with month comparison
**Description:** A dedicated review surface (new page, or a mode on `index.html`) that lets the user browse past months' summaries via `state.months{}`, and view two months side-by-side for comparison.
**Rationale:** The most literal answer to "review portals." `computeMonthVerdict` already accepts any `monthKey`, so browsing history and comparing two months costs mostly layout work, not new computation. The one idea that's an actual new surface rather than a widget on an existing page.
**Downsides:** Largest of the survivors — new UI mode, month-picker, comparison layout.
**Confidence:** 75%
**Complexity:** Medium-High
**Status:** Unexplored

### 5. Per-paycheck composition breakdown
**Description:** A breakdown visual organized by paycheck rather than category — two side-by-side bars or donuts (Paycheck 1, Paycheck 2), each showing income → bills → goals → leftover.
**Rationale:** A domain-specific breakdown axis a generic budgeting app wouldn't think of — this app's actual mental model is per-paycheck allocation, not just spending categories. Genuinely differentiated from a standard category pie chart.
**Downsides:** Narrower appeal than the category breakdown; more valuable once goal/bill data is already well-populated.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored

### 6. Goal Health Board
**Description:** A compact view combining a funded-streak indicator (which of the last N months each goal was fully funded) with traffic-light status badges per goal, surfaced on `index.html` without needing to open `allocator.html`.
**Rationale:** "Am I consistent?" is a longitudinal question no current view answers. Cheap to build once ideas #1 and #2 exist — reuses the same funded/unfunded classification already computed per month.
**Downsides:** Compounding value — weaker as a standalone first move, stronger as a follow-on once trend/goal-bar infrastructure exists.
**Confidence:** 65%
**Complexity:** Medium
**Status:** Unexplored

### 7. Dependency-free SVG chart primitive library
**Description:** A single shared JS helper (e.g. `sparkline()`, `bar()`, `donut()`) generating inline SVG, loaded by both pages, used as the rendering foundation for ideas #1-#6 instead of five one-off implementations.
**Rationale:** Makes every other visual idea in this set cheaper and visually consistent. The smallest addition that unlocks disproportionate value across the rest of the list — proves the "no framework, no build step" constraint doesn't block real charting. Recommended as the first move if more than one visual idea gets picked.
**Downsides:** Zero user-visible value on its own; only pays off once something calls it.
**Confidence:** 80%
**Complexity:** Low
**Status:** Explored (brainstorm started 2026-08-11)

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Bill due-date timeline/calendar visualization | Real question ("when does money leave") but narrower value than the survivors, and calendar grids are fiddly to hand-roll in SVG for the payoff |
| 2 | Automatic passive breakdown on every index load | Not a distinct idea — a placement/timing decision for the category chart (default-visible vs. click-to-reveal), not separate value |
| 3 | Month-close-out auto-popup retrospective | Speculative pain point (no evidence of forgetting to review); an unsolicited popup is a naggy pattern for a single-user tool, and the Historical Review Mode solves the same need without interrupting |
| 4 | Ambient inline sparklines on every bill/category row | Cuts against the architecture just shipped in the prior session — `allocator.html` was deliberately simplified to editing-only; this re-clutters a page that just got decluttered |
| 5 | Money-flow/Sankey diagram | Highest implementation complexity of the batch (hand-rolled proportional flow paths in SVG) for value that's mostly a fancier restatement of the category and per-paycheck breakdowns combined |
| 6 | Budget-vs-actual bars for variable categories | Substantially overlaps with the category spending breakdown chart — a natural overlay once that chart exists, not a separate feature |
| 7 | Structural reframe (which page is primary, index vs. allocator) | Reopens the index.html/allocator.html split decided and shipped in the immediately-prior PR, without new evidence it isn't working — premature |
| 8 | Single collapsed budget-health gauge | No evidenced pain point that 3 cards is *too much* information (the opposite gap — no visuals at all — is what's evidenced); real risk of losing detail for glanceability |
| 9 | Extend Zapier/Sheets pipe for visual review | The focus hint asks for review in the app itself, following two sessions of in-app feature work — routing review to an external tool undercuts that intent even though the pipe exists |

## Session Log
- 2026-08-11: Initial ideation — 38 raw candidates generated across 4 frames (pain/friction, inversion/automation, assumption-breaking, leverage/compounding), merged to 16 distinct after dedup, 7 survived adversarial filtering.
- 2026-08-11: User selected idea #7 (SVG chart primitive library) to brainstorm first, as the recommended foundation for the rest of the set.

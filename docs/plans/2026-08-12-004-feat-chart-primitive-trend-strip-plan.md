---
title: Dependency-Free SVG Chart Primitive + Month-Over-Month Trend Strip
type: feat
status: active
date: 2026-08-12
origin: docs/brainstorms/2026-08-12-chart-primitive-and-trend-strip-requirements.md
---

# Dependency-Free SVG Chart Primitive + Month-Over-Month Trend Strip

## Overview

Adds the first data visualization anywhere in the app: a small SVG trend strip on `index.html` showing the "Remaining" figure across the most recent months, built on a new shared, dependency-free SVG chart primitive library (`chart.js`, providing `sparkline()`, `bar()`, `donut()`). Only `sparkline()` ships with a real consumer in this pass. The trend strip requires `allocator.html` to start persisting a frozen per-month history snapshot (`state.history`), which doesn't exist today — the largest technical piece of this plan is getting that snapshot semantics right without silently rewriting past months' figures when bills or goals change today.

## Problem Frame

See origin document for full framing. In short: `state.months{}` already accumulates monthly data every time the user navigates in `allocator.html`, but nothing visualizes it, and neither page has ever rendered a chart. This plan pairs a new shared SVG chart primitive with its first real consumer (the trend strip) rather than building an API from guesses (see origin: docs/brainstorms/2026-08-12-chart-primitive-and-trend-strip-requirements.md).

## Requirements Trace

- R1-R4. New shared script `chart.js` provides `sparkline()`, `bar()`, `donut()` — inline SVG, no dependencies, no build step. Colors/styling are caller-supplied. First shared `<script src>` in the codebase; only `index.html` loads it this pass. All three functions are built now (explicit user choice, reaffirmed twice during brainstorm review and re-raised a third time by two plan-review personas — reaffirmed again, not reopened); only `sparkline()` has a real caller.
- R5-R8. `index.html` gains a trend strip beneath the 3 summary cards, plotting "Remaining" for up to the 6 most recent *existing* month keys. Zero months hides the section; one month renders a lone point. Native SVG `<title>` tooltips only. Each point colored individually by that month's own status.
- R9. `allocator.html` snapshots a month's `computeMonthSummary()` result into `state.history`, live-updating only while that month is the real current calendar month, then frozen permanently.
- R9a. A one-time backfill fills in pre-existing months using current bill/goal definitions (accepted migration limitation).
- R9b. The backfill runs unconditionally on load, not only inside the edit-gated `persist()` path.
- R10. `index.html` remains free of verdict-computation logic.
- R11. `awaiting`-status months get a distinct neutral point, not skipped and not `$0`.

## Scope Boundaries

- `bar()` and `donut()` ship with no real UI caller — accepted risk, may need rework once idea #3 or #5 from the ideation set is picked up.
- No shared "theme" abstraction — colors are explicit per call.
- Trend strip only plots "Remaining" — no income/bills toggle, no multi-line view.
- No changes to `allocator.html`'s own UI/rendering beyond the `state.history` snapshot computation — it gains no visible chart itself in this pass.
- Does not merge or restructure the two-page architecture.
- No custom touch/keyboard interaction for exact-value lookup — desktop hover via native `<title>` is the only precise-value path.
- Backfilled figures for months never revisited after this ships reflect today's bill/goal definitions, not true point-in-time accuracy — accepted migration limitation, not a bug to chase.
- Trend strip points are not clickable/tappable to navigate to that month in `allocator.html` — raised during plan review (design-lens) as a real but out-of-scope interaction; deliberately deferred, not an oversight.
- Editing a logged entry while viewing a non-current month (e.g. catching up on a past month) does not update that month's already-frozen `state.history` entry — only the real current calendar month's entry updates live (see Key Technical Decisions). This is a narrower version of the same accepted-limitation spirit as R9a's backfill.

## Context & Research

### Relevant Code and Patterns

**`allocator.html`** (confirmed via direct read):
- `let state = loadState();` — `allocator.html:471`.
- `persist()` — `allocator.html:473-476`: `state.summary = computeMonthSummary(monthKey); saveState(state);`.
- `computeMonthSummary(monthKey)` — `allocator.html:627-643` — already returns exactly the shape a history entry needs: `{status, totalIncome, totalBills, remaining}` (or the awaiting-shaped variant). Reused as-is for history entries rather than duplicated.
- Gated first-load call — `allocator.html:654-658`: `if (!state.currentMonthKey) { state.currentMonthKey = monthKey; persist(); }` — does **not** fire for a returning user who already has a `currentMonthKey`, which is why the backfill (Unit 2) cannot live inside this block.
- `prev-month`/`next-month` handlers — `allocator.html:964-965` — each does `monthKey = shiftMonthKey(monthKey, ±1); state.currentMonthKey = monthKey; persist(); renderAll();`. Critically, `persist()` runs unconditionally on every navigation, not just on edits — confirmed during plan review that this is why the history write inside `persist()` must be gated on the real calendar-current month rather than assumed to freeze naturally (see Key Technical Decisions).
- `state.months` — initialized in `defaultState()` (`allocator.html:403-413`, field at line 409); read/written via `getOrCreateMonth` (`allocator.html:466-469`).
- `loadState()` — `allocator.html:428-450` — builds its return object **field-by-field**, not by spreading `parsed`. `paydays`(439), `goals`/`bills`/`categories`(440-442), `months`(443), `currentMonthKey`(444), `summary`(445). A new `history` field needs its own explicit line here or it is silently dropped on load.
- `computeMonthVerdict` (`allocator.html:597-609`) / `computeCycleVerdict` (`allocator.html:583-595`) — unchanged, underlying math this plan does not touch.

**`index.html`** (confirmed via direct read):
- `<head>` open/close: lines 3/124. No existing `<script src>` anywhere — this plan adds the first one.
- Sole inline `<script>` block: lines 153-273.
- `loadState()` — lines 168-185 — same field-by-field pattern as `allocator.html`; already reads `currentMonthKey`/`summary` explicitly (179-180) and needs a `history` line added the same way.
- Summary grid CSS — lines 59-64 (`.summary`); card markup — lines 137-150 (`.summary` div closes 150, `.container` closes 151). The trend strip slots in as a new sibling section between them.
- `renderSummary()` — line 228 (body 228-245); `render()` — lines 247-250 (calls `renderHeader()` + `renderSummary()`); invoked at line 272. `renderTrendStrip()` joins this call chain.

Confirmed via repo-wide search: zero `.js` files, zero SVG/canvas/`createElementNS` code, zero other `<script src>` tags anywhere in the repo today — this feature is the first of each.

### External Research

Skipped. Hand-rolled SVG sparklines (a `<path>` plus `<circle>` points) are a standard, well-understood technique with no framework or library involved — the entire point of this feature is staying dependency-free — so fetching external docs would add little practical value over direct implementation.

## Key Technical Decisions

- **`state.history` shape**: `state.history["YYYY-MM"] = { status, totalIncome, totalBills, remaining }` — the exact object `computeMonthSummary()` already returns, stored verbatim. Chosen because it requires no new computation function; `persist()` already computes this object every call and can simply also assign it into `state.history[monthKey]`.
- **Freeze-on-navigate-away must target the real calendar month explicitly, not gate on `persist()`'s displayed month** — the original draft of this decision ("since `persist()` only ever runs for `state.currentMonthKey`, writing history inside it automatically freezes on navigate-away") was falsified during plan review (adversarial reviewer, confirmed by direct code read). `persist()` (`allocator.html:475-476`) closes over the module-global `monthKey`, and both `prev-month`/`next-month` handlers reassign `monthKey` to the *destination* month before calling `persist()` unconditionally — not gated on any edit occurring. A first fix (gate the write on `monthKey === monthKeyOf(new Date())`) closed that hole but introduced a new one, caught by two independent implementation-time code reviewers (testing, correctness): since bills/goals are global, editing one while merely *parked* on a non-current month never refreshed the real current month's entry either, leaving it stale with no self-healing. **Final design**: `persist()` always writes `state.history[monthKeyOf(new Date())]` — computed fresh via `computeMonthSummary(realCurrentMonthKey)`, or reused from `state.summary` when the displayed month happens to already be today's — regardless of which month is currently displayed or what triggered the call. Every other month's entry is never touched by `persist()` at all. This both prevents the original retroactive-rewrite bug (a past month's key is never the write target) and self-heals staleness (any edit anywhere refreshes today's figure) and self-heals a phantom future-month freeze the moment that month actually becomes current (see `backfillHistory()` decision below for the other half of that fix). Accepted narrowing: editing a logged entry while viewing a non-current *past* month does not retroactively refresh that past month's frozen figure — see Scope Boundaries.
- **`backfillHistory()` must not backfill future months** — found by adversarial review (0.85 confidence) and independently by data-migrations review of the shipped code: merely clicking "next month" to preview an upcoming month auto-creates an empty `state.months` entry as a side effect of `computeMonthVerdict()` → `getOrCreateMonth()`, even with zero edits. Since `backfillHistory()` originally treated any key present in `state.months` as backfill-eligible, it would permanently freeze that empty future month as `{status: 'awaiting'}` before it was ever live — and because `"YYYY-MM"` keys sort lexicographically by chronological order, that phantom entry could sort after the real current month and displace a genuine month from index.html's "last 6" trend strip window. Fixed by restricting backfill to `mk <= monthKeyOf(new Date())` — a month is only ever backfilled once it has actually arrived.
- **Backfill and live-update share one code path**: `backfillHistory()` (new function) loops over `Object.keys(state.months)` and, for any key **missing** from `state.history`, computes `computeMonthSummary(monthKey)` and assigns it. It never overwrites an existing entry, so it can safely run on every load without disturbing already-frozen months — no separate "has backfill run" flag is needed; after the first run there is nothing left to backfill except new months, which `persist()` handles going forward.
- **Backfill trigger point**: called unconditionally right after `let state = loadState();` (`allocator.html:471`), before the existing gated first-load `persist()` block (`allocator.html:654-658`) — satisfies R9b, since that gated block does not fire for returning multi-month users.
- **Chart primitive functions return SVG strings, not DOM nodes**: matches the codebase's existing convention of building markup via template literals assigned to `innerHTML` (e.g. `allocator.html`'s card rendering) rather than introducing a second DOM-construction style.
- **Sparkline null/awaiting handling**: a point with `value: null` renders at a fixed neutral vertical position in the caller's neutral color, with its own `<title>` (e.g. "Awaiting income"), but the connecting path **breaks** on either side of it rather than drawing a line through a fabricated position — drawing through it would visually imply a real data point that doesn't exist.
- **Point spacing is uniform-by-index, not time-proportional**: raised during plan review (design-lens) — if a user's history has a gap (e.g. history for January and February, then June), evenly-spaced points would visually imply February→June continuity. Accepted as-is for this pass, consistent with R5's existing "not calendar-anchored with gaps" simplicity choice and R6's "show whatever exists" framing — a single-user app visited roughly monthly makes large gaps rare, and adding gap-proportional spacing or a "months aren't consecutive" cue is deferred rather than built speculatively.
- **Trend strip SVG carries a minimal accessible name**: the outer `<svg>` gets `role="img"` and an `aria-label` summarizing the trend (e.g. "Remaining, last 6 months") — raised during plan review (design-lens) as a real, near-zero-cost gap since per-point `<title>` tooltips require mouse hover and give screen reader users nothing otherwise. Broader accessibility work (redundant non-color status encoding, keyboard-focusable points) is not undertaken this pass — this is intentionally the cheapest fix that avoids leaving the chart totally silent to assistive tech.

## Implementation Units

### Unit 1: SVG chart primitive library
**Goal**: `chart.js` provides `sparkline(points, options)`, `bar(segments, options)`, `donut(segments, options)`, each returning an SVG markup string, no dependencies.

**Files**: `chart.js` (new)

**Approach**:
- `sparkline(points, options)` — `points: [{value: number|null, color, label}]`, `options: {width, height, pointRadius, ariaLabel}`. Renders one `<svg role="img" aria-label="{ariaLabel}">` containing a `<path>` per contiguous run of non-null points (see Key Technical Decisions on breaking around null points) and one `<circle>` per point, each with a nested `<title>{label}</title>` for native hover tooltips.
- `bar(segments, options)` — `segments: [{value, color, label}]`, `options: {width, height, orientation}`. Proportional rectangles sized to each segment's share of the total.
- `donut(segments, options)` — `segments: [{value, color, label}]`, `options: {width, height, innerRadiusRatio}`. Proportional arc paths with a hollow center.
- No hardcoded colors anywhere in the file — every color comes from the caller's `points`/`segments` data.

**Patterns to follow**: `allocator.html`'s existing template-literal-to-`innerHTML` rendering style, for consistency even though there's no prior local SVG example to follow directly.

**Test scenarios**:
- `sparkline([])` — returns without throwing (empty/no-op markup); real callers are expected not to invoke it with zero points (Unit 3 handles that), but the primitive itself must be safe.
- `sparkline([{value: 100, ...}])` — single `<circle>`, no `<path>`.
- `sparkline` with 2+ all-real-valued points — one continuous `<path>` connecting them; each `<circle>` colored per its own point.
- `sparkline` with a null point in the middle of real points — path renders as two separate segments around the gap; the null point still renders its own neutral `<circle>` and `<title>`.
- `bar()`/`donut()` with 2-3 segments — produces valid, non-throwing SVG markup proportional to segment values (no real caller to validate against yet, per accepted R4 risk).

**Verification**: Playwright — load a scratch HTML page that includes `chart.js`, call each function with sample data, assert on rendered SVG element counts/attributes, and visually screenshot to confirm it looks like a chart.

### Unit 2: `state.history` data layer (`allocator.html`)
**Goal**: Persist a frozen per-month "remaining" snapshot, written live only while a month is current, plus a one-time backfill for pre-existing months.

**Files**: `allocator.html`

**Approach**:
- Add `history: {}` to `defaultState()` (near line 409) and as an explicit field in `loadState()`'s return (near line 445), matching the existing `summary` field's pattern exactly.
- In `persist()` (lines 475-476), after `state.summary = computeMonthSummary(monthKey);`, add: compute `realCurrentMonthKey = monthKeyOf(new Date())`, then unconditionally set `state.history[realCurrentMonthKey]` to `{ ...state.summary }` when `monthKey === realCurrentMonthKey`, or to a fresh `computeMonthSummary(realCurrentMonthKey)` otherwise — before `saveState(state)`. Always targeting the real calendar-current month (never the displayed `monthKey`) is required — see Key Technical Decisions for why both the naive "write whatever's displayed" version and a first gated fix each broke under navigation.
- Add `backfillHistory()`: for each key in `Object.keys(state.months)` not already present in `state.history` **and not later than the real current calendar month**, compute `computeMonthSummary(key)` and assign it in. Call `saveState(state)` once at the end, only if at least one entry was added. The future-month exclusion is required — see Key Technical Decisions for the phantom-future-month freeze this prevents.
- Call `backfillHistory()` unconditionally, immediately before the existing gated first-load block (`let monthKey = state.currentMonthKey || monthKeyOf(new Date());`). **Implementation-time correction**: not immediately after `let state = loadState();` as originally planned — `backfillHistory()` transitively calls `computeMonthSummary()`, which depends on `const roundCents`/`monthKeyOf` declared further down the script; calling it before those `const` lines execute throws a temporal-dead-zone `ReferenceError`. Verified via Playwright that placing the call just before the gated first-load block (after all `const` helpers are initialized) works correctly.

**Patterns to follow**: `computeMonthSummary` (`allocator.html:627-643`) — reused verbatim, not duplicated. `loadState()`'s field-by-field style (`allocator.html:428-450`).

**Test scenarios**:
- Fresh install, empty `state.months` — `backfillHistory()` is a no-op, no `saveState()` call.
- Existing user with 3 pre-existing month keys, none in `state.history` — all 3 get backfilled from current bill/goal definitions in a single `saveState()` call.
- Reopening after history is already fully backfilled — no entries missing, no `saveState()` call (idempotent).
- Editing a bill while viewing the real current calendar month — `state.history[<real current month>]` updates live to match the fresh `computeMonthSummary()` result.
- Navigating back to a past month with zero edits made — `state.history[<that past month>]` does not change. This is the scenario that broke the original "write on every `persist()` call" design during plan review: mere browsing must never rewrite an already-frozen entry, even though `persist()` still runs on every navigation to save `currentMonthKey`.
- Editing a bill while *parked* on a non-current month (e.g., browsing July while August is real-current) — `state.history[<real current month, e.g. August>]` still updates live, since the write always targets the real calendar-current month regardless of what's displayed. This is the staleness case two implementation-time reviewers (testing, correctness) caught: an earlier gated-on-displayed-month design left today's entry stale until the user happened to navigate back to it.
- Adding a logged entry to a past (non-real-current) month while parked on it — `state.history[<that past month>]` still does not change (accepted narrowing, see Scope Boundaries).
- Clicking "next month" repeatedly to preview a future month with zero edits, then reloading the page — `state.history[<that future month>]` is never created by `backfillHistory()` (it only backfills months `<= ` the real current month), even though `state.months[<that future month>]` now exists as an empty entry. This is the phantom-future-month-freeze scenario caught by adversarial and data-migrations review of the shipped code.
- A month with `status: 'awaiting'` — its history entry stores the awaiting-shaped object (no numeric `remaining`), not skipped and not omitted.

**Verification**: Playwright — seed multi-month `state` into `localStorage`, load `allocator.html`, inspect `state.history` via `page.evaluate`, navigate months and edit bills, re-inspect to confirm freeze/live-update behavior matches the scenarios above.

### Unit 3: `index.html` trend strip
**Goal**: Render up to the 6 most recent existing months' Remaining figures as a `sparkline()` beneath the 3 summary cards.

**Files**: `index.html`

**Depends on**: Unit 1 (`sparkline()`), Unit 2 (`state.history` must exist and be populated).

**Approach**:
- Add `history: {}` to `defaultState()` (line 163) and to `loadState()`'s field-by-field return (lines 173-181), matching Unit 2's shape.
- Add `<script src="chart.js"></script>` before the inline `<script>` block (before line 153).
- Add a new markup section as a sibling immediately after `.summary` closes (after line 150, before line 151's `.container` close) — a container `<div>` for the trend strip.
- Add `renderTrendStrip()`: read `Object.keys(state.history)`, filtering out any entry that isn't a well-formed object (matching `renderSummary()`'s existing defensive convention at `index.html:230-235` for guarding against a missing/malformed persisted value), sort the remainder ascending as `"YYYY-MM"` strings, take the last 6. Map each to `{value: entry.status === 'awaiting' ? null : entry.remaining, color: <positive/negative/neutral CSS var based on status>, label: "<Month Year>: <formatted $ or 'Awaiting income'>"}`. If the resulting array is empty, the mount div's `innerHTML` is cleared to `''` rather than populated with the labeled `.trend-strip` section. **Implementation-time correction** (maintainability review): the plan originally said the container element itself would "never be inserted into the DOM," but the shipped code keeps a persistent, content-neutral `#trend-strip-mount` div always present as a mount point (matching every other static element in this file) and only conditionally fills it — it's the semantically-meaningful `.trend-strip` section (heading + chart) that's absent, not the mount point. This satisfies the origin requirement's intent ("doesn't render at all" — verified via `document.querySelector('.trend-strip')` returning null) without literally never-inserting any element. Otherwise call `sparkline()` — passing an `aria-label` summarizing the range, e.g. "Remaining, last N months" (see Key Technical Decisions) — and set the container's `innerHTML`, preceded by a lightweight static heading/label so the chart has legible context without requiring a hover (raised during plan review, design-lens: without it, the section is an unlabeled row of dots).
- Call `renderTrendStrip()` from `render()` (lines 247-250) alongside the existing calls.
- Add CSS for the new section: full container width (scales via the SVG's `viewBox`, no separate breakpoint needed beyond the existing 540px one at `index.html:66-68`), ~70px height, positioned directly under `.summary`, using the page's existing `--positive`/`--negative`/`--text-muted` custom properties for point colors so it matches the established positive/negative/awaiting visual language.

**Patterns to follow**: `renderSummary()` (`index.html:228-245`) for read-only state-to-DOM rendering; `.summary`/`.summary-card` CSS (`index.html:59-122`) for color-token reuse.

**Test scenarios**:
- Zero months in `state.history` — trend strip section is absent from the DOM (not present-but-hidden, not an empty container).
- One month — renders a single point, no connecting line.
- 2-6 months — renders a connected line, one point per month, each individually colored by its own status.
- More than 6 months of history — only the 6 most recent are shown.
- An `awaiting` month among real months — renders as a distinct neutral point with the line breaking around it.
- Each point's `<title>` text matches the expected month label and formatted dollar figure (or "Awaiting income").
- A malformed or unexpectedly-shaped `state.history` entry (e.g. missing `status`) — filtered out rather than thrown on or rendered as a broken point, matching `renderSummary()`'s existing defensive convention for corrupted persisted data.

**Verification**: Playwright — seed varying `state.history` contents into `localStorage` (0, 1, 3, 6+, and awaiting-inclusive cases), load `index.html`, screenshot, and assert SVG point/path counts and `<title>` text against expectations.

## Dependencies / Sequencing

Units 1 and 2 have no dependency on each other and can proceed in either order. Unit 3 depends on both and must be implemented last.

## Risks

- `bar()`/`donut()` ship unvalidated against real usage (accepted, R4).
- Backfilled history for months never revisited after this ships reflects today's bill/goal definitions rather than true point-in-time figures (accepted migration limitation, R9a).
- Native `<title>` tooltips are mouse-hover-only; touch users see trend shape but not exact per-month figures (accepted, R7).

## Deferred to Implementation

- Exact pixel/viewBox dimensions and point spacing for `sparkline()` beyond the rough sizing above — a rendering-detail decision best made by looking at the actual chart once wired up.
- Exact hex/CSS-var color values passed by `index.html` for positive/negative/awaiting points — should reuse the page's existing `--positive`/`--negative`/`--text-muted` tokens, exact application left to implementation.

## Dependencies / Assumptions

- Builds on the unified `budget-v1` data model and `computeMonthSummary`/`persist()` pattern from `docs/plans/2026-08-10-003-feat-unified-budget-data-plan.md`.
- Assumes `state.months{}` keys are reliably parseable `"YYYY-MM"` strings for sorting — already true of existing `monthKeyOf`/`shiftMonthKey` conventions.

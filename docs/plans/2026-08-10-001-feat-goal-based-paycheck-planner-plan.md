---
title: Goal-Based Paycheck Planner Page
type: feat
status: completed
date: 2026-08-10
origin: docs/brainstorms/2026-08-10-goal-based-paycheck-planner-requirements.md
---

# Goal-Based Paycheck Planner Page

## Overview

Add a new standalone static page, `allocator.html`, to the existing single-page budgeting site. The page lets the user define savings goals, fixed bills, and variable spending categories once (they persist across months), log actual paycheck income and spending per month, and see a dashboard-first verdict — per paycheck and for the month as a whole — on whether income covers everything, including which specific goal(s) fall short when it doesn't. Logging actual spending is not just record-keeping: overspending against a bill or category's budgeted amount actively reduces the verdict, same as the source draft's model.

This is a from-scratch vanilla-JS build that ports the *logic* (not the JSX/React shape) of the existing `PaycheckAllocator.tsx` draft: the bill-due-day-to-paycheck-cycle assignment and the bucket-by-category allocated/spent/overage model. The draft's free-text entry parser, `window.storage` calls, and React structure are explicitly not carried forward.

## Problem Frame

See origin document for full context. In short: the site's current page (`index.html`) only answers "income minus bills, for the month." The user wants a page centered on their savings goals — stated up front — checked against real bills and spending, with an unambiguous answer to "does the money make it, and if not, what doesn't get funded."

## Requirements Trace

- R1–R4 (Goals): define, prioritize/reorder, priority-cutoff funding, monthly-only targets (R4 is satisfied by the goal data shape itself carrying no deadline/cumulative field — see Unit 1)
- R5–R6 (Bills): define, due-day-to-cycle assignment
- R7–R8 (Variable Spending): define, counts before goals
- R9 (Editing & Removal): edit/remove definitions, blocked while referenced
- R10–R12 (Paycheck & Time Structure): two-paycheck model, month navigation, per-paycheck income field
- R13–R14 (Entry & Tracking): structured entry form, edit/remove/move entries
- R15–R18 (Verdict): dashboard-first, per-paycheck + month verdict, shortfall detail, surplus/break-even
- R19–R21 (Page & Navigation): standalone page, nav link, draft's visual identity retained
- R22–R23 (Data & Persistence): `localStorage`, global definitions vs. per-month income/entries

## Scope Boundaries

(see origin document — unchanged, plus one confirmation from this planning session)

- No bank/account integration or transaction import
- No natural-language entry parsing
- No cross-month cumulative goal progress or deadline tracking
- No user accounts/auth or multi-device sync
- Not replacing or modifying `index.html`'s own planner logic (only adding a nav link to it)
- Two-paycheck-per-month model only — confirmed with the user during planning that actual pay is semi-monthly (always exactly 2 paychecks/month), so biweekly/3-paycheck handling is explicitly out of scope, not just deferred
- No historical provenance/snapshotting for past months when a global definition is edited later (see Key Technical Decisions — Live/global definitions) — accepted tradeoff for a single-user tool, not a gap to close later without a deliberate re-decision
- No multi-tab/multi-window conflict handling for simultaneous `localStorage` writes — accepted risk for a single-user local tool

## Context & Research

### Relevant Code and Patterns

- `index.html` — the conventions this page must match: `:root` CSS custom properties for the whole palette, `box-sizing: border-box` reset, single inline `<style>`/`<script>`, flat state object persisted via `localStorage.setItem(KEY, JSON.stringify(state))`, `loadState()`/`saveState()` pair with try/catch fallback to an empty-state constructor, discrete `render*()` functions doing full-innerHTML re-renders (no diffing), event listeners wired once at load, `crypto.randomUUID()` for IDs, `Intl.NumberFormat('en-US', {style:'currency', currency:'USD'})` for money, `YYYY-MM` month keys via `getCurrentMonth()`/`toLocaleDateString`, a single `@media (max-width: 540px)` breakpoint collapsing multi-column layouts to one column.
- `PaycheckAllocator.tsx` lines 203–248 (`computeCycle`) — the bucket-by-category allocation model to port conceptually: a map keyed by target, with `allocated`/`spent`/`overage` per bucket. A `planned`-status entry *overrides* a bucket's `allocated` amount for that cycle; a `paid`-status entry accumulates into `spent`; `overage = max(0, spent − allocated)` per bucket. This is the exact mechanic this plan reuses to make the verdict actuals-aware (see Key Technical Decisions). This project's version keys buckets by `{targetType, targetId}` instead of by name string (see Key Technical Decisions — this also closes a name-collision gap the draft had).
- `PaycheckAllocator.tsx` line 212 — due-day-to-cycle assignment rule (`dueDay >= payday1 && dueDay < payday2` → cycle 1, else cycle 2), carried forward with an added `payday1 < payday2` validation the draft never had.
- `PaycheckAllocator.tsx` lines 20–29 — default bills/paydays (payday1=1, payday2=15) worth reusing as this page's shipped defaults, so paydays are never in an unconfigured/blank state (see Unit 1).
- `PaycheckAllocator.tsx` lines 61–68 — `money()`/`ordinal()` formatting helpers worth reusing in shape (not `uid()`, which uses a weaker `Math.random()` generator than `index.html`'s `crypto.randomUUID()`).
- Explicitly **not** porting: `PaycheckAllocator.tsx` lines 40–59 and 73–127 (`KEYWORDS`, `PAID_WORDS`, `PLAN_WORDS`, `parseEntry`) — the free-text parser is replaced by structured forms per R13. (Line range corrected during document review — it does not include lines 61–68, which are reused per above.)

### Institutional Learnings

None found — `docs/solutions/` does not exist yet in this repo (confirmed via research). General practices applied instead: guard `localStorage` reads/writes with try/catch (matching `index.html`'s `loadState` pattern, extended to `saveState` too — see Unit 1), and round money consistently to avoid float drift in the even-split/fractional-funding math.

### External References

None — plain HTML/CSS/JS with strong local precedent (`index.html`) and no security/payments/external-API surface; external research was skipped as low-value for this work.

## Key Technical Decisions

- **New `localStorage` key, own namespace**: `goal-paycheck-planner-v1` (or similar), distinct from `index.html`'s `budgetPlanner-v1` and the draft's `paycheck-allocator-v3`/`window.storage`. The two pages' data never mix.
- **Entries reference `{targetType, targetId}`, not a category name string**: unlike the draft's `touch(cat)` name-keyed map, buckets are keyed by definition ID. This structurally eliminates the draft's name-collision risk.
- **Verdict is actuals-aware for bills and categories, via the draft's planned/paid mechanic** *(resolved during planning — the user chose actuals-aware over budget-only)*: a `planned` entry logged against a bill or category overrides its budgeted amount for that cycle (e.g. "the electric bill is actually $140 this month"); a `paid` entry accumulates as spend against that bucket's (possibly overridden) budgeted amount; any `spent − budgeted` overage draws from the money available before goals are funded. This directly answers the "does planned status affect the verdict" question raised in document review: yes, via overriding the budgeted amount, exactly matching the draft's existing mechanic.
- **Goals are not actuals-aware the same way**: a goal's funded amount for verdict purposes is the priority-cutoff-computed amount (see below), not adjusted by logged entries against it — logging a paid entry against a goal is a confirmation ledger ("I moved this money"), not an input back into the funding formula. This avoids a circular dependency (goal funding is already computed dynamically from what's left after bills/categories/overage) and keeps the goal math simple. Scoped deliberately, not left ambiguous.
- **Fractional goal funding, targets halved per paycheck**: each goal's *monthly* target is split evenly across both paychecks (same rule as R7's category split) before the priority-cutoff pass runs per cycle. Goals are funded top-down by priority from whatever money remains after bills/categories/overage: a goal fully covered by remaining money shows as funded, the one goal that only partially fits shows its actual funded amount against its half-target (e.g. "$60 of $100"), and everything after it shows $0 funded. The total shortfall reported in the verdict (R17) is the sum of `half-target − funded` across all under-funded goals, per cycle. *(Resolved during planning; the per-cycle halving was implicit in an earlier draft of this plan and is now stated explicitly, per document review.)*
- **Month-level verdict is computed independently, not summed from the two paychecks**: the "month as a whole" verdict (R16) re-runs the same allocation/priority-cutoff logic using summed income (p1+p2) against the *full* (un-halved) bill list, category budgets, and goal targets, and its own overage totals — rather than adding the two per-paycheck verdicts together. This lets a paycheck-2 surplus meaningfully offset a paycheck-1 shortfall in the month view, while each paycheck's own card still answers its own self-contained question. Deliberately different from the draft's simple `c1.free + c2.free` addition.
- **Blank income is a distinct state from $0 income**: an unfilled income field renders the cycle's verdict as "awaiting income" (neutral, not a shortfall), rather than treating blank as $0 and reporting a large false shortfall on every new month.
- **Live/global definitions — edits apply to all months, past and future** (per R23 and explicit user decision): editing a goal's target or removing a bill changes the numbers everywhere immediately, including past months. A short inline note near the edit controls says this explicitly. Past-month views carry no separate "this has changed since then" indicator (see Scope Boundaries) — an accepted simplicity tradeoff for a single-user tool, not an oversight.
- **Default paydays ship pre-configured** (payday1=1, payday2=15, matching the draft's own defaults) so the page is never in an unconfigured/blank-payday state; `payday1 < payday2` is validated on the config form, and the due-day-before-`payday1` wraparound-to-cycle-2 behavior is otherwise kept exactly as the draft defined it.
- **Vanilla JS/DOM, no build step, no React** — see origin document.

## Open Questions

### Resolved During Planning

- Verdict is actuals-aware: overspending against a bill/category (via logged `paid` entries exceeding a possibly-`planned`-overridden budgeted amount) reduces the verdict — see Key Technical Decisions. This also resolves whether `planned`-status entries affect the math (yes, by overriding the budgeted amount for that cycle).
- Goals are funded via priority-cutoff computation, not adjusted by logged entries against them — scoped deliberately to avoid circular computation.
- Goal targets are halved per paycheck for the per-cycle funding calculation, same as category budgets — now stated explicitly in Unit 2 and the flowchart (was previously only implied).
- Pay cadence confirmed semi-monthly (always 2 paychecks/month) with the user — biweekly/3-paycheck handling is out of scope, not just deferred.
- Blank vs. $0 income are treated as distinct states — see Key Technical Decisions.
- Definitions are live/global; edits retroactively affect past months, with an inline UI note; no historical snapshotting — resolved with the user during this planning session.
- `payday1 < payday2` validation is added; paydays ship with defaults (1/15) so there's no unconfigured state; the draft's due-day wraparound behavior otherwise carries forward unchanged.
- Per-paycheck vs. month-total verdict disagreement: both are shown as independently-computed, plainly-labeled statements (e.g. "Paycheck 1 — short $80" / "Month total — surplus $20"); no attempt to reconcile or explain the difference beyond showing both.
- Entries can only move between the two paychecks within the same month (mirrors the draft's `moveEntry`), not across months.
- Removing a goal/bill/category blocked by out-of-view entries: the block message names which month(s) have referencing entries, so the block isn't a dead end.
- Editing an existing logged entry (R14) is an in-place correction (the same structured form pre-filled with the entry's current target/amount/status), not a remove-and-re-add — consistent with the form already built for creating entries in Unit 6.
- Even-split rounding (e.g. a $100.01 monthly target split across two paychecks): round each half to the nearest cent independently; accept that this can very rarely leave a $0.01 residue in an otherwise "break-even" month rather than building remainder-distribution logic for it (YAGNI for a single-user tool).
- `localStorage` save failures get a lightweight, persistent on-page notice (not just silent in-memory fallback) so the user knows changes aren't surviving a reload — extends the draft's own "changes stay for this session only" messaging to this page.
- Responsive behavior follows `index.html`'s existing single-breakpoint approach (`@media (max-width: 540px)`, multi-column layouts collapse to one column) rather than a new mobile strategy — no established multi-breakpoint precedent exists in this repo to follow instead.
- The verdict banner (Unit 5) gets a live-region announcement (`aria-live="polite"`) so a screen-reader user is told when it changes state, matching the "dashboard-first, trustworthy at a glance" goal for sighted and non-sighted users alike.

### Deferred to Implementation

- Exact DOM structure/class names for the verdict banner's different states (awaiting-income, bills-exceed-income, short, surplus, break-even) — implementer's discretion, following `index.html`'s CSS-variable-driven styling approach.
- Exact wording/microcopy for each verdict state and the "definitions are global" inline note.
- Reorder interaction mechanics for goals (drag vs. up/down buttons) — implementer's discretion; note the accessibility tradeoff (buttons are simpler to make keyboard-accessible).
- First-time empty-state copy for goals/bills/categories sections before anything is configured.
- Structured entry form's exact validation messages (empty amount, etc.).
- Whether to add a `schemaVersion` field to the persisted object now (low cost, low urgency for a single-user app) — recommended but not blocking.

## High-Level Technical Design

> This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.

**Data shape** (conceptual, not literal code):

```
state = {
  paydays: { p1: 1, p2: 15 },                      // shipped defaults, always configured
  goals:      [ { id, name, target } ]              // order = priority; target = monthly amount
  bills:      [ { id, name, amount, dueDay } ]
  categories: [ { id, name, amount } ]               // variable spending, monthly amount
  months: {
    "YYYY-MM": {
      income:  { p1, p2 }                            // blank = not entered yet
      entries: [ { id, targetType: bill|goal|category, targetId, amount, status: paid|planned, cycle: 1|2 } ]
    }
  }
}
```

`goals`/`bills`/`categories` are global (R23); `months[key]` is the only per-month-scoped data.

**Per-paycheck verdict flow** (per cycle, per month):

```mermaid
flowchart TD
  A[income for this cycle] -->|blank| Z["Awaiting income"]
  A -->|entered| B0[bills due this cycle + half of each<br/>category budget = budgeted amounts;<br/>a 'planned' entry overrides a bucket's<br/>budgeted amount for this cycle]
  B0 --> B1[paid entries accumulate as spent per bucket;<br/>overage = sum of max(0, spent−budgeted)]
  B1 --> B{budgeted + overage &lt;= income?}
  B -- no --> C["Bills exceed income<br/>shortfall = (budgeted+overage) − income<br/>(no goal breakdown shown)"]
  B -- yes --> D[remaining = income − budgeted − overage]
  D --> E[fund goals top-down by priority using<br/>each goal's half-of-monthly-target;<br/>each goal funded fully, fractionally,<br/>or 0, until remaining reaches 0<br/>— not affected by logged entries]
  E --> F{any goal under-funded?}
  F -- yes --> G["Short $X<br/>(X = sum of half-target−funded across<br/>under-funded goals); list them"]
  F -- no --> H{remaining after goals == 0?}
  H -- yes --> I["Covers everything — break-even"]
  H -- no --> J["Covers everything — surplus $X"]
```

The month-level verdict re-runs this same flow with summed income and full (un-halved) bill/category/goal amounts, independent of the two per-paycheck results (see Key Technical Decisions).

## Implementation Units

- [x] **Unit 1: Data model & persistence**

**Goal:** Establish the state shape, `localStorage` load/save, and month-key scoping that every later unit builds on.

**Requirements:** R4, R11, R12, R22, R23

**Dependencies:** None

**Files:**
- Create: `allocator.html` (script section only — state/persistence logic; UI comes in later units)

**Approach:**
- Flat state object per the Data Shape above; `goals`/`bills`/`categories` global (goal objects intentionally carry no deadline/cumulative-progress field, satisfying R4), `months[monthKey]` per-month. `paydays` ships pre-populated with defaults (1, 15) rather than blank.
- `loadState()`/`saveState()` mirroring `index.html`'s try/catch-guarded pattern, extended so `saveState` also catches write failures and surfaces a small persistent on-page notice (not just a silent in-memory fallback) when saves stop succeeding.
- Helper to get-or-create a month's entry (`{income: {p1:'', p2:''}, entries: []}`) so navigating to a new month doesn't require special-casing elsewhere.
- New `localStorage` key, isolated from `index.html` and the draft.

**Patterns to follow:**
- `index.html`'s `loadState`/`saveState`/`createEmptyState` functions.
- `PaycheckAllocator.tsx` lines 20–29 for the shipped-default shape (paydays, and optionally seed bills, though seeding demo bills is implementer's discretion, not required).

**Test scenarios:**
- Happy path: fresh load with nothing in `localStorage` → default state (empty goals/bills/categories, default paydays 1/15, no months).
- Happy path: save then reload → identical state round-trips.
- Edge case: navigating to a month key that doesn't exist yet in `months` → get-or-create returns a blank income/entries shape without mutating stored state until an actual change is made.
- Error path: `localStorage.setItem` throws (simulate via quota/private-browsing) → save failure doesn't crash the page; a visible notice appears; state remains usable in-memory for the session.
- Error path: stored JSON is corrupted/unparseable → falls back to default state instead of throwing on load.

**Verification:**
- Reloading the page after making changes preserves goals, bills, categories, paydays, and the current month's income/entries.
- Corrupting the stored value in devtools and reloading does not throw or blank-crash the page.
- Simulating a storage write failure surfaces a visible, on-page notice (not just a console error).

---

- [x] **Unit 2: Allocation & verdict computation**

**Goal:** Pure computation functions for per-cycle and month-level allocation, funding, and verdict state — the core "does the money make it" logic, kept free of DOM code so it's easy to reason about and manually verify against worked examples.

**Requirements:** R3, R6, R8, R13, R16, R17, R18

**Dependencies:** Unit 1 (state shape)

**Files:**
- Modify: `allocator.html` (script section — computation functions)

**Approach:**
- Due-day → cycle assignment, ported from the draft's rule, plus a `payday1 < payday2` validation used by the config UI (Unit 4).
- Per-cycle bucketing for bills and categories: budgeted amount starts as the definition's amount (bill amount if due this cycle, half of category budget); a `planned`-status entry for that bucket this cycle overrides the budgeted amount; `paid`-status entries accumulate as spend; `overage = max(0, spent − budgeted)` per bucket, summed into `totalOverage`.
- `budgetedAndOverage = billsBudgeted + categoriesBudgeted + totalOverage`. Verdict per the High-Level Technical Design flowchart: blank income → awaiting-income; `budgetedAndOverage > income` → bills-exceed-income with a single shortfall number; otherwise `remaining = income − budgetedAndOverage`, then walk goals in priority order — each goal's per-cycle target is **half its monthly target** — funding fully/fractionally/zero from `remaining` (goals are not entry-adjusted, per Key Technical Decisions), then classify as short / break-even / surplus.
- Month-level verdict: same logic, independent pass, using summed income and full (un-halved) bill/category/goal amounts and their own overage totals — not a sum of the two per-cycle verdicts (see Key Technical Decisions).
- Money rounding to the cent at each split/allocation step.

**Technical design:** See High-Level Technical Design flowchart above — directional, not implementation-ready.

**Patterns to follow:**
- `PaycheckAllocator.tsx`'s `computeCycle` (lines 203–248) for the bucket/allocated/spent/overage shape, adapted to key by `{targetType, targetId}`, to support fractional goal funding, and to exclude goals from the entry-adjustment mechanic.

**Test scenarios:**
- Happy path: income covers bills + categories + all goals with money left over → surplus state with correct leftover amount.
- Happy path: income covers everything exactly, zero left over → break-even state (not treated as a shortfall).
- Happy path: two goals with monthly targets $100 and $80 (half-targets $50/$40); $90 remains after bills/categories/overage → first goal fully funded ($50 of $50), second goal fractionally funded ($40 of $40 if $90-$50=$40 covers it exactly — adjust example so the boundary goal is genuinely partial, e.g. remaining $70 → first goal funded $50, second goal funded $20 of $40) → shortfall = $20 (sum of half-target−funded across under-funded goals).
- Happy path: a `planned` entry overrides a bill's budgeted amount for the cycle (e.g. bill default $150, planned entry logs $140) → that cycle's budgeted amount uses $140, not $150.
- Happy path: a `paid` entry exceeds its bucket's budgeted amount (e.g. $130 paid against a $100 category) → $30 overage reduces `remaining` before goals are funded.
- Edge case: income field blank for a cycle → "awaiting income" state, not a false shortfall.
- Edge case: bill due-day falls before `payday1` → assigned to cycle 2 per the carried-forward wraparound rule.
- Edge case: `payday1 >= payday2` attempted → rejected by validation before it reaches the allocation logic.
- Edge case: a goal's target is $0 or a category budget is $0 → treated as always-funded/no-op, doesn't distort the shortfall math.
- Edge case: a `paid` entry logged against a goal → does not change that goal's funded amount (ledger only, per Key Technical Decisions).
- Error path: bills + categories + overage alone exceed income (before any goal is considered) → bills-exceed-income state, single shortfall number, no goal list.
- Integration: month-level verdict computed independently can show surplus even when one individual paycheck shows short (and vice versa) — confirms the two are genuinely independent, not summed.

**Verification:**
- A handful of worked examples (paper-checked dollar amounts) match what the functions return for: full surplus, exact break-even, goal cutoff mid-list with fractional funding, planned-entry override, paid-entry overage, and bills-exceed-income.

---

- [x] **Unit 3: Page shell, styling, and cross-page nav**

**Goal:** Stand up `allocator.html` as a real page with the draft's visual identity, and link the two pages together.

**Requirements:** R15, R19, R20, R21

**Dependencies:** Unit 1 (so the shell has state to render against, even if later units fill in the UI)

**Files:**
- Modify: `allocator.html` (HTML structure, `<style>` block)
- Modify: `index.html` (add nav link to `allocator.html`)

**Approach:**
- Port the draft's palette (cream background, navy/purple/gold, serif headings) into `:root` custom properties, following `index.html`'s CSS-variable convention rather than the draft's inline `style={{}}` objects.
- Dashboard-first layout: a verdict section fixed at the top of the page, detail sections (goals, bills, categories, entries, config) below, per R15.
- Responsive behavior follows `index.html`'s existing single-breakpoint approach: multi-column layouts (paycheck cards, summary stats) collapse to one column under `max-width: 540px`.
- Add a small text nav link in both pages' headers (`index.html` → `allocator.html` and back) — there's no existing multi-page nav pattern in this repo, so this establishes the convention.

**Patterns to follow:**
- `index.html`'s `:root` variable block, `.container`/`.section` card layout, and `@media (max-width: 540px)` breakpoint as the structural/responsive convention; the draft's specific color values and serif font stack as the visual identity for this page only (R21 — it does not need to match `index.html`'s look).

**Test scenarios:**
- Happy path: opening `allocator.html` directly renders the page shell with the verdict area visible above the fold (no scrolling needed) on a typical desktop viewport.
- Happy path: nav link from `index.html` reaches `allocator.html` and back, both work.
- Happy path: narrowing the viewport below 540px collapses multi-column sections to one column without overlapping or clipped content.
- Test expectation: none beyond the above — this unit is primarily structural/styling with no branching behavior yet.

**Verification:**
- Visual check in a browser: verdict area is the first thing visible; palette matches the draft (cream/navy/purple/gold/serif); nav links work both directions; layout holds up narrowed to a phone-width viewport.

---

- [x] **Unit 4: Definitions management (goals, bills, categories, paydays)**

**Goal:** CRUD UI for the global definitions — goals (with reordering), bills, spending categories, and payday configuration — including the edit/remove-blocked-while-referenced rule.

**Requirements:** R1, R2, R5, R7, R9, R10

**Dependencies:** Units 1–3

**Files:**
- Modify: `allocator.html`

**Approach:**
- Add/edit/remove forms for each of the three definition lists, following `index.html`'s inline add-form + rendered-list pattern.
- Goal reordering (mechanics deferred to implementation — see Open Questions); reordering only changes list position/priority, nothing else.
- Removal check: before deleting a goal/bill/category, scan all `months[*].entries` for references; if any exist, block the removal and name which month(s) contain the blocking entries rather than a generic "can't delete" message.
- Payday config inputs, pre-filled with the shipped defaults (1/15), with `payday1 < payday2` validation from Unit 2, inline error on violation, save blocked until valid.

**Patterns to follow:**
- `index.html`'s add-form + list-render pattern (`renderList`, `renderEntryRow`-equivalent) for each of the three definition types.

**Test scenarios:**
- Happy path: add a goal/bill/category, it appears in its list and becomes available as an entry target (Unit 6) and in allocation (Unit 2).
- Happy path: edit a goal's target amount → verdict recalculates immediately (per the live/global decision) with an inline note that this affects all months.
- Happy path: reorder goals → priority order changes, next verdict computation reflects the new order.
- Edge case: attempt to remove a goal/bill/category with zero referencing entries anywhere → succeeds immediately.
- Edge case: attempt to remove one with referencing entries in a past month not currently being viewed → blocked, message names the month(s).
- Error path: attempt to save paydays with `payday1 >= payday2` → rejected with inline validation error, no state change.

**Verification:**
- Adding, editing, reordering, and removing each of the three definition types works end-to-end and is reflected in the verdict on the next render.

---

- [x] **Unit 5: Paycheck dashboard & verdict display**

**Goal:** Render the two paycheck cards (income input + per-cycle verdict) and the month-total verdict, using Unit 2's computation functions — this is the page's central, highest-value surface.

**Requirements:** R12, R15, R16, R17, R18

**Dependencies:** Units 1, 2, 3, 4 (needs definitions to allocate against)

**Files:**
- Modify: `allocator.html`

**Approach:**
- One income input field per paycheck card, wired to `months[key].income.{p1,p2}`; blank stays blank (not coerced to 0) per the Unit 2 decision.
- Verdict banner rendering each state from Unit 2's flow: awaiting-income, bills-exceed-income, short (with unfunded/partially-funded goal list), break-even, surplus — each with distinct, unambiguous copy per R17/R18. The banner container carries `aria-live="polite"` so a screen-reader user is told when its state changes.
- Per-goal detail list showing funded/partial/unfunded status and amounts underneath the verdict, so the summary number and the itemized detail are always consistent.
- Month-total verdict section computed independently per Unit 2, displayed alongside (not merged into) the two per-paycheck verdicts.

**Patterns to follow:**
- `PaycheckAllocator.tsx`'s paycheck-card layout (two cards, click-to-select active cycle) as a structural reference — reimplemented in vanilla JS/DOM, not JSX.

**Test scenarios:**
- Happy path: entering income for both paychecks with goals/bills/categories configured produces the correct verdict state and dollar amounts for surplus, break-even, and short cases (reuses Unit 2's worked examples).
- Happy path: goal detail list shows a partially-funded goal's actual funded amount, matching Unit 2's fractional-funding output.
- Edge case: one paycheck's income entered, the other blank → that paycheck shows its real verdict, the other shows "awaiting income," and the month-total reflects the incomplete data rather than a false number.
- Integration: editing a bill's amount (Unit 4) or logging a paid entry that creates overage (Unit 6) immediately changes the verdict shown here on next render, without a page reload — confirms the definitions/entries → computation → display chain is live.

**Verification:**
- With a representative set of goals/bills/categories and both incomes entered, the verdict banner and per-goal detail list are internally consistent (funded/unfunded/partial amounts sum to what the banner states).
- Changing the verdict's state (e.g. by logging an overage entry) triggers an announced change for screen-reader testing (verify via browser accessibility inspector).

---

- [x] **Unit 6: Entry logging, ledger, and month navigation**

**Goal:** Structured entry form and ledger (replacing the draft's free-text parser), plus prev/next month navigation.

**Requirements:** R11, R13, R14

**Dependencies:** Units 1, 4, 5 (needs definitions to pick from, and the verdict to react to)

**Files:**
- Modify: `allocator.html`

**Approach:**
- Structured entry form: a target picker (populated from current goals+bills+categories), amount field, paid/planned toggle, submit. Disabled with a prompt to add a definition first when all three lists are empty.
- Editing an existing entry reuses the same structured form, pre-filled with that entry's current target/amount/status — not a remove-and-re-add flow.
- Ledger list per paycheck, mirroring the draft's entry row (status toggle, description/target name, amount, remove) but sourced from structured data instead of parsed free text.
- Move-between-paychecks control, restricted to the two cycles within the current month (not cross-month, per Open Questions).
- Prev/next month navigation swapping which month's income/entries are shown; definitions stay constant across months (R23) per Unit 1's shape.

**Patterns to follow:**
- `PaycheckAllocator.tsx`'s ledger row (`toggleStatus`, `moveEntry`, `removeEntry`) for interaction shape, adapted to structured entries instead of parsed ones.
- `index.html`'s month-key navigation pattern (`shiftMonth`-equivalent) if present, otherwise the draft's `shiftMonth`.

**Test scenarios:**
- Happy path: log a `paid` entry against a bill/goal/category → ledger shows it, verdict recalculates (for bills/categories, per Unit 2's overage mechanic; for goals, ledger-only per Key Technical Decisions).
- Happy path: log a `planned` entry against a bill/category → distinguished from paid in the ledger, overrides that bucket's budgeted amount for the cycle per Unit 2.
- Happy path: edit a logged entry's amount → the form opens pre-filled, saving updates the entry in place and the verdict recalculates.
- Happy path: move an entry from one paycheck to the other within the same month → it disappears from one card's ledger and appears in the other's, verdict for both recalculates.
- Edge case: no goals/bills/categories defined yet → entry form shows a disabled state with a prompt to add a definition first, per Unit 4.
- Edge case: navigate to a month with no entries yet → empty ledger state, income fields blank, doesn't error.
- Integration: removing an entry that was the sole reference blocking a definition's deletion (Unit 4) unblocks that deletion on the next attempt.

**Verification:**
- Logging, editing, removing, and moving entries all correctly update the ledger and the verdict; navigating between months preserves each month's own income/entries while definitions stay constant.

## System-Wide Impact

- **Interaction graph:** Entirely self-contained within `allocator.html`; the only cross-file touch is a nav-link addition to `index.html` (no shared state, no shared `localStorage` key).
- **State lifecycle risks:** Definitions are global/live (deliberate — see Key Technical Decisions), so an edit in Unit 4 immediately changes what Units 5/6 render; the removal-block check in Unit 4 is the main safeguard against inconsistent state (an entry pointing at a deleted definition).
- **Unchanged invariants:** `index.html`'s own state, `localStorage` key, and behavior are untouched — this plan only adds a link to it.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Money math drift (float rounding across even-splits, fractional goal funding, and overage) | Round to the cent at each computation step (Unit 2); accept rare $0.01 residue rather than building remainder-distribution logic |
| Porting the draft's `computeCycle` logic introduces subtle behavior differences, now further extended with fractional goal funding | Unit 2's verification step uses hand-checked worked examples covering surplus, break-even, fractional cutoff, planned-override, paid-overage, and bills-exceed-income before later units build on it |
| No automated test framework exists in this repo | Every unit's test scenarios are written for manual verification in-browser, consistent with `index.html`'s existing all-manual verification approach; scenarios are specific enough to execute directly |
| `localStorage` write failures (quota, private browsing) silently losing data | Unit 1 wraps `saveState` in try/catch and surfaces a visible on-page notice, not just an in-memory fallback |
| Retroactive edits to global definitions silently change past months' verdicts (accepted tradeoff, see Scope Boundaries) | Inline note at edit time only; no historical snapshotting. Revisit only if this proves confusing in practice — do not build snapshotting speculatively |
| Simultaneous edits across multiple open tabs/windows could silently overwrite each other | Accepted risk for a single-user local tool (see Scope Boundaries); no `storage`-event reconciliation planned |

## Documentation / Operational Notes

- No build/deploy changes — `allocator.html` ships the same way `index.html` does (static file, `.nojekyll`-served).
- Consider seeding `docs/solutions/` with any non-obvious fixes discovered during implementation (e.g., via `ce-compound`), since this repo has no institutional learnings yet.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-08-10-goal-based-paycheck-planner-requirements.md](docs/brainstorms/2026-08-10-goal-based-paycheck-planner-requirements.md)
- Related code: `index.html`, `PaycheckAllocator.tsx`

---
date: 2026-08-10
topic: unified-budget-data
---

# Unify Budget Data Across Cash Flow Planner and Paycheck Allocator

## Problem Frame

`index.html` (Monthly Cash Flow Planner) and `allocator.html` (Paycheck Allocator) currently maintain fully separate data — different `localStorage` keys, and incompatible bill/income shapes (`index.html` bills have no due date at all; its income is a list of named entries, while `allocator.html` bills require a due date and its income is exactly two paycheck amounts). This forces double entry of the same bills and income, and there's no single "what does my whole month look like" view that also reflects paycheck-by-paycheck planning — `index.html` shows a flat monthly total with no paycheck detail, `allocator.html` shows per-paycheck detail with no rollup.

The user wants one shared data source: enter a bill, income figure, goal, or category once, and see it reflected as a monthly total on `index.html` and as paycheck-by-paycheck detail on `allocator.html`.

This deliberately reverses a scope boundary from the original `allocator.html` plan ("not replacing or modifying `index.html`") — noted explicitly since it's an informed reversal, not an oversight.

## Requirements

**Data Unification**
- R1. Bills, income, goals, and categories become one shared data source used by both `index.html` and `allocator.html` — entering or editing any of them happens once and is reflected on both pages.
- R2. Bills carry a due date (`dueDay`) in the unified model, matching `allocator.html`'s existing bill shape; `index.html`'s due-date-less bill shape is retired.
- R3. Income becomes exactly two paycheck amounts (`p1`, `p2`) per month, matching `allocator.html`'s existing model; `index.html`'s itemized/named income-entries list is retired.
- R4. Goals and categories (variable spending) — previously `allocator.html`-only concepts — become part of the shared data and factor into `index.html`'s rollup (see R7).
- R5. Both pages track one shared "currently viewed month" — navigating to a different month on `allocator.html` and then opening `index.html` shows that same month's summary, and vice versa.
- R6. No migration of existing data is required. This ships as a clean-slate data model change; whatever is currently in either page's `localStorage` is not carried forward.

**`index.html` Becomes a Summary View**
- R7. `index.html` no longer has its own add/edit forms for bills or income. It becomes read-only: total income (`p1`+`p2`), total bills, and a "Remaining" figure computed as the **sum of `allocator.html`'s two per-paycheck verdicts** (each paycheck's goals funded independently against its own half, same rule as `allocator.html`'s existing paycheck cards) — not a simplified income-minus-bills-only number, and not a separate whole-month recomputation. *(Resolved during document review: `allocator.html` internally has two non-equivalent verdict formulas — per-paycheck-summed vs. a single whole-month pass — which can disagree when goal funding lands unevenly across paychecks. The per-paycheck-summed reading was chosen explicitly.)*
- R7a. `index.html` collapses entirely to the 3 summary cards (income, bills, remaining) — no read-only itemized bill/income list. Line-item detail (which bill, which due date) stays on `allocator.html`.
- R8. `index.html`'s "Remaining" card gets a third neutral/"awaiting income" state, matching `allocator.html`'s distinction between "no income entered yet" and an actual shortfall — in addition to its existing positive/negative styling. Unentered paycheck income must not silently compute as $0 and render as a misleading "positive" card.
- R9. `index.html` retains its cross-link to `allocator.html` (and vice versa) so the user can move to `allocator.html` to actually add or edit bills, income, goals, categories, or logged entries.
- R9a. The verdict/priority-funding logic `index.html` depends on (R7) is extracted into a shared script file both pages load via `<script src>`, rather than duplicated inline. This is a deliberate, scoped exception to both pages' current "fully self-contained, no shared files" convention — limited to this one piece of logic.
- R9b. `index.html`'s "days left in the month" header text only applies when the shared viewed month (R5) is the real current calendar month; it's hidden or replaced with different copy for past/future months.
- R9c. `index.html`'s existing "your saved data is from a different month" confirmation prompt is retired — it's made obsolete by the shared "currently viewed month" model in R5.

**`allocator.html` Stays the Editing Workspace**
- R10. `allocator.html` keeps all of its existing editing capability (bills, goals, categories, paydays, logged entries, month navigation) with unchanged behavior — it becomes the sole place data is entered or edited, but its own functionality doesn't change.

## Success Criteria
- The user can add a bill (with due date) once, from `allocator.html`, and see it reflected in both `allocator.html`'s paycheck cards and `index.html`'s monthly totals — no re-entry.
- Opening `index.html` shows the same month `allocator.html` was last navigated to, and a "Remaining" figure that matches what `allocator.html`'s verdict would show if you summed both paychecks.
- `index.html` no longer has any bill or income entry forms of its own.

## Scope Boundaries
- No migration of pre-existing data from either page's current `localStorage` — this is a clean-slate data model change, by explicit choice.
- `index.html` does not gain per-paycheck breakdown, due-date editing, goal/category management, or entry logging — all editing stays on `allocator.html`.
- No changes to `allocator.html`'s existing paycheck-level behavior, verdict logic, or UI beyond reading/writing the newly-shared data shape and moving its verdict/priority-funding functions into the shared script (R9a) that `allocator.html` also loads.
- Does not merge the two pages into one page/URL — they remain two separate HTML files with distinct visual identities, now sharing a data layer (and, per R9a, one small shared logic file) instead of separate data.
- `index.html` does not gain a read-only itemized bill/income list (R7a) — only the 3 summary cards.

## Key Decisions
- **Single shared data source, not a sync/copy between two stores**: entering a bill once makes it available everywhere — resolves the double-entry pain that was one of two roughly-equal motivations for this request.
- **`allocator.html`'s data shapes become canonical**: bills gain due dates (`index.html`'s due-date-less shape retired), income becomes two paycheck amounts (`index.html`'s itemized income list retired) — chosen because paycheck-level planning requires this shape, and it's simpler than inventing a new synthesis model.
- **`index.html` becomes read-only/summary-only**: avoids building and maintaining two sets of edit UI for the same data; all editing consolidates on `allocator.html`, which already has the richer forms.
- **`index.html`'s "Remaining" mirrors `allocator.html`'s full verdict math**, not a simplified income-minus-bills view — so "Remaining" means the same thing on both pages.
- **Shared "current month" across both pages**: consistent "what am I looking at" when moving between pages, rather than `index.html` always defaulting to today's real-world calendar month regardless of where `allocator.html` was navigated.
- **No data migration**: explicit choice to start fresh rather than build migration logic for incompatible legacy shapes (particularly `index.html`'s due-date-less bills and itemized income). Since the app already has an Export button on each page (`docs/plans/2026-08-10-002-feat-zapier-sheets-budget-sync-plan.md`), the recommendation is to remind the user to export both pages before this ships, as an informal personal backup — not a real migration path, just cheap insurance given the feature already exists.
- **Deliberately reverses the original `allocator.html` plan's boundary** ("not replacing or modifying `index.html`") — an informed reversal now that the product need has changed, not an oversight.
- **`index.html`'s "Remaining" = sum of `allocator.html`'s two per-paycheck verdicts**, not a separate whole-month computation — chosen explicitly after document review surfaced that `allocator.html` has two non-equivalent verdict formulas internally (see R7).
- **Verdict logic extracted to a shared script file (R9a)**, not duplicated — the only exception to the "fully self-contained pages" convention, scoped narrowly to avoid drift risk in ~100-150 lines of priority-funding math.

## Dependencies / Assumptions
- Builds on `allocator.html`'s existing logic: bill due-day/paycheck-assignment, goal priority-funding, and category handling (see `docs/brainstorms/2026-08-10-goal-based-paycheck-planner-requirements.md`) — this brainstorm assumes that logic is reused as the canonical model, not redesigned.
- Builds on `index.html`'s existing summary-card layout and positive/negative "Remaining" styling (`index.html`, `.summary-card` block) — assumed to be reused for the new rollup rather than rebuilt.
- The recently-shipped Export/Zapier-sync feature (`docs/plans/2026-08-10-002-feat-zapier-sheets-budget-sync-plan.md`) was built around each page's *current*, now-retired data shapes (e.g., `dueDay` didn't exist on `index.html` bills; income was itemized on `index.html`). Planning should account for whether that feature's field mappings need updating to match the unified model, or explicitly scope that as separate follow-up work.

## Outstanding Questions

### Deferred to Planning
- [Affects R1][Technical] Storage mechanism: one shared `localStorage` key/object used by both pages, or two keys kept in sync — a technical choice, not a product one.
- [Affects R7][Technical] Exact `index.html` summary card layout: whether goals/variable-spending get their own dedicated cards or fold into the existing 3-card total, now that R7a has settled there's no itemized list — this affects numeric transparency (today's cards let income − bills = remaining be checked at a glance; folding goals/categories into "Remaining" without a visible breakdown could make that arithmetic guarantee less obvious).
- [Affects R9a][Technical] Exact shape of the extracted shared script — which specific functions move (verdict computation, priority-funding, bucket/overage handling), and how `allocator.html`'s own script tag is updated to load it instead of defining them inline.
- [Affects Dependencies][Needs research] The Zapier/Sheets export feature's `index.html` tab currently exports `index.html`'s own independent `state` object — once `index.html` is read-only and shares `allocator.html`'s data, it may no longer have independent state to export. Planning should decide whether `index.html`'s export button now re-exports the shared data (likely duplicating `allocator.html`'s export), is removed, or is merged into a single export — this is a bigger question than just updating field mappings.
- [Affects R3][Needs research] Whether `allocator.html`'s fixed two-paycheck-per-month model accommodates irregular pay schedules (e.g. months with three paychecks) — not raised as a blocker since this mirrors the existing, already-shipped `allocator.html` behavior, but worth confirming during planning if it's ever been a real constraint.

## Next Steps
-> /ce:plan for structured implementation planning

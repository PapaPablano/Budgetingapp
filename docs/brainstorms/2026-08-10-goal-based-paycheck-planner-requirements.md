---
date: 2026-08-10
topic: goal-based-paycheck-planner
---

# Goal-Based Paycheck Planner

## Problem Frame

The site currently has `index.html`, a simple income-vs-bills planner, and an uploaded draft (`PaycheckAllocator.tsx`) that models bills and reserves per paycheck but frames everything around envelope budgeting rather than the user's actual question: *"Here's what I want to do with my money — will my paycheck actually cover it, or will it come up short?"*

The user wants a new page that puts personal savings **goals** first, lays out bills and everyday spending clearly underneath, and gives an unambiguous verdict on whether the money makes it — and if not, exactly what falls short. The foundation needs to be easy to read and easy to adjust, since bills, spending, and goals all change over time.

## Requirements

**Goals**
- R1. User can define multiple named savings/spending goals (e.g. "Vacation fund", "Emergency fund"), each with a monthly target dollar amount.
- R2. Goals are ranked by priority via their order in the list (top = highest priority); user can reorder them (e.g. move up/down or drag).
- R3. When there isn't enough money for all goals, goals are funded top-down by priority order until money runs out; goals below the cutoff are shown as unfunded (or partially funded) for that month. Each goal's monthly target is split evenly across both paychecks for this calculation, same rule as R7's spending-category split — so each paycheck's verdict stays self-contained.
- R4. Goals are monthly targets only — no cumulative/total-with-deadline tracking across months.

**Bills & Fixed Obligations**
- R5. User can define fixed bills, each with a category name, amount, and due day of month (ported from the draft's bill model).
- R6. Bills are automatically assigned to whichever paycheck cycle covers their due day, same logic as the draft.

**Variable Spending**
- R7. User can define variable/day-to-day spending categories (groceries, gas, dining, etc.) with a monthly budgeted amount, split evenly across both paychecks (same "reserve" split behavior as the draft).
- R8. Variable spending categories count against income alongside bills, before goals are considered.

**Editing & Removal**
- R9. User can edit (name, amount, and due day where applicable) or remove any goal, bill, or spending-category definition after creation — not just the logged entries against it. *(Added: Success Criteria already promised this; R1/R5/R7 only covered creation.)* Removal is blocked while logged entries still reference that definition — the user must reassign or delete those entries first, so the verdict math is always well-defined.

**Paycheck & Time Structure**
- R10. Retain the draft's two-paycheck-per-month structure (configurable payday 1 / payday 2), with each paycheck showing its own numbers and a combined month rollup — same as the draft.
- R11. Retain month-to-month navigation (prev/next month), with each month keeping its own income entries and logged activity.
- R12. Each paycheck's income is entered directly on that paycheck's card as a single editable amount field (ported from the draft's per-check income input), scoped per month per R11. *(Added: R11 referenced "income entries" without stating how income is actually entered.)*

**Entry & Tracking**
- R13. User can log an actual amount against a specific bill, goal, or spending category via a structured form (dropdown/select target, amount, paid/planned toggle) — no free-text parsing.
- R14. User can edit or remove a logged entry, and move it between paychecks (ported behavior from the draft).

**Verdict / Money Fit Check**
- R15. The page opens with a dashboard-first summary: the verdict/money-fit status is displayed prominently at the top of the page, visible without scrolling, with editable detail sections (goals, bills, spending, entries) below — rather than only revealed at the bottom of the page. *(Clarified: "dashboard-first" is now defined at point of use, not just in Key Decisions.)*
- R16. The verdict clearly states, per paycheck and for the month as a whole, whether income covers bills + variable spending + goals, or is short.
- R17. When short, the verdict shows the total shortfall amount **and** which specific goal(s) — per R3's priority cutoff — don't get funded that month. If bills + variable spending alone exceed income (i.e. every goal is already unfunded and the deficit is larger still), the verdict still shows the single shortfall dollar amount but swaps the label to something like "Bills exceed income" instead of listing unfunded goals.
- R18. When there's enough, the verdict shows the surplus/leftover amount after bills, spending, and all goals are funded — including when that amount is exactly zero (break-even). *(Clarified: the amount displays regardless of whether it's positive or zero.)*

**Page & Navigation**
- R19. Ship as a new standalone page (e.g. `allocator.html`) alongside the existing `index.html`, not a replacement — both are static HTML/CSS/JS with no build step, consistent with the current project.
- R20. Add a small nav link between `index.html` and the new page so a user can move between the two tools.
- R21. Keep the draft's existing visual identity (cream background, navy/purple/gold palette, serif headings) on the new page; it does not need to match `index.html`'s styling.

**Data & Persistence**
- R22. Persist all data (bills, goals, spending categories, entries, paydays, per-month income) to `localStorage`, replacing the draft's non-functional `window.storage` calls (that API only exists in the sandbox the draft was authored in, not in a real browser).
- R23. Goal, bill, and spending-category *definitions* (R1, R5, R7) are global and persist across months — editing one applies going forward, matching the draft's top-level `bills`/`sinking` state. Only income (R12) and logged entries (R13) are scoped per month, matching the draft's `months`/`entries` state. *(Added: R11 scoped income/activity per month but never stated whether the definitions themselves are global or per-month — resolved from the draft's own data model.)*

## Success Criteria
- A user can look at the page and, within a few seconds, know whether this paycheck (and this month) covers their bills, spending, and goals — or exactly how much and which goal(s) come up short.
- Adding, editing, reordering, or removing a goal, bill, or spending category takes only a couple of direct interactions (no free-text parsing to fight with).
- The two-paycheck structure and per-month history from the draft are preserved, so due-date-aware bill splitting keeps working.

## Scope Boundaries
- No bank/account integration or transaction import — entries are logged manually.
- No natural-language entry parsing (explicitly replaced by structured forms).
- No cross-month cumulative goal progress or deadline tracking — goals are monthly targets only.
- No user accounts/auth or multi-device sync — `localStorage` only, same as `index.html` today.
- Not replacing or modifying `index.html`.

## Key Decisions
- **Goal-first, dashboard-first layout**: Verdict/summary sits at the top of the page (not a narrative goals→bills→verdict scroll), so the "does it fit" answer is immediately visible on return visits, with adjustable detail below.
- **Structured forms over NL parsing**: The draft's free-text parser is dropped in favor of explicit forms, prioritizing clarity and low-friction adjustment over fast freeform entry.
- **Priority = list order**: Goal priority is implicit in list position rather than a separate priority field, keeping reordering/adjusting simple.
- **Separate page, draft's own visual style retained**: New page (`allocator.html`) rather than replacing `index.html`; keeps the draft's distinct look rather than reskinning to match the existing planner.
- **`localStorage` replaces `window.storage`**: The draft's storage calls target a sandbox-only API; this is a required correctness fix, not a product decision, but noted here since it affects R22.
- **Vanilla JS/DOM port, no build step**: `PaycheckAllocator.tsx` is React/JSX; per the user's explicit choice during scoping, it is rewritten as plain HTML/CSS/JS (matching `index.html`'s pattern) rather than loaded via a React+Babel CDN or turned into a build-tooled app. R19's "no build step" requirement depends on this.
- **Definitions are global, not per-month**: Goals/bills/spending-category definitions persist across months (edit once, applies going forward); only income and logged entries reset per month key — matching the draft's existing state shape (`bills`/`sinking` vs `months`/`entries`).
- **Goal targets split evenly across paychecks**: Same treatment as variable-spending categories (R7), so each paycheck's verdict is self-contained and doesn't depend on the other paycheck's numbers.
- **Deletion blocked while referenced**: Removing a goal/bill/category with logged entries against it is blocked until those entries are reassigned or deleted — avoids orphaned data and keeps the verdict math always well-defined, at the cost of one extra step when cleaning up old categories.
- **Severe shortfall keeps one number, changes the label**: When bills/spending alone exceed income, the verdict still shows a single shortfall figure (not a second "bills shortfall" number) but relabels it so it doesn't imply goals are the cause.

## Dependencies / Assumptions
- Builds on logic already present in `PaycheckAllocator.tsx` (bill due-day assignment, per-paycheck computation, reserve/category splitting) — this document assumes that logic is reused/ported into vanilla JS, not redesigned.

## Outstanding Questions

### Deferred to Planning
- [Affects R2][Technical] Reorder interaction mechanics (drag-and-drop vs. up/down buttons) — implementation detail for planning; note accessibility implications (keyboard/screen-reader support) when choosing.
- [Affects R3, R17][Technical] Exact partial-funding display when a goal only gets funded halfway — worth confirming against the simplest reading (whole goals funded top-down, no fractional funding) during planning.
- [Affects R15, R16][Needs research] Verdict states for incomplete data: what shows before any income/bills/goals are entered, or before a paycheck's income is filled in.
- [Affects R13][Needs research] Validation/error states for the structured entry form (empty amount, target since deleted, duplicate entries).
- [Affects R1, R5, R7][Needs research] First-time empty-state content for the goals/bills/spending sections before anything is configured.
- [Affects R10][User decision] The two-paycheck-per-month model matches semi-monthly pay; if actual pay is biweekly (occasionally 3 paychecks in a month), confirm whether that's out of scope or needs handling.
- [Affects R22][Technical] Whether to add a minimal schema-version field to the persisted `localStorage` object now, to ease future data-shape changes (low cost, single-user app so low urgency).

## Next Steps
-> /ce:plan for structured implementation planning

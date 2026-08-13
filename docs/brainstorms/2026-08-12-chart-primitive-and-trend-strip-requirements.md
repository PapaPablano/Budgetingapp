---
date: 2026-08-12
topic: chart-primitive-and-trend-strip
---

# SVG Chart Primitive Library + Trend Strip (Ideation Idea #7)

## Problem Frame

`index.html` and `allocator.html` have zero data visualization anywhere — everything is plain text and numbers. Idea #7 from `docs/ideation/2026-08-11-review-portals-and-breakdown-visuals-ideation.md` proposed a shared, dependency-free SVG chart-rendering helper as the foundation for the other review/breakdown visual ideas in that set. Since a primitive with no caller has no user-visible value, this brainstorm pairs it with a real first consumer: a month-over-month trend strip on `index.html`, using the `state.months{}` history that `allocator.html` already accumulates but nothing currently visualizes.

## Requirements

**Chart Primitive**
- R1. A new shared script file provides three chart-rendering functions — `sparkline()`, `bar()`, `donut()` — generating inline SVG, no external dependencies, no build step.
- R2. Colors/styling are passed in by the caller, not hardcoded to either page's palette — `index.html` and `allocator.html` have genuinely different visual identities established in earlier sessions.
- R3. This is the first shared `<script src>` file in the codebase. Only `index.html` loads it in this pass, via its real consumer (the trend strip). `allocator.html` adds the tag later, when one of its own chart ideas (category breakdown, per-paycheck breakdown) actually needs it.
- R4. Only `sparkline()` ships with a real, working consumer in this pass. `bar()` and `donut()` are implemented now per explicit choice but have no real caller yet — treat them as unvalidated against real usage.

**Trend Strip (first consumer)**
- R5. `index.html` gains a trend strip beneath the existing 3 summary cards, plotting the "Remaining" figure (not income or bills) across up to the last 6 months of history. "Last 6 months" means the 6 most recent *existing* month keys in `state.history`, sorted — not 6 calendar-anchored slots with visible gaps for months that don't exist.
- R6. Shows whatever history actually exists, rather than requiring a minimum number of months or padding with placeholder data. Zero months (a brand-new install, before `allocator.html` has ever been used): the trend strip section doesn't render at all. Exactly one month: renders a single point with no connecting line/path, since a line needs two points.
- R7. Each point is a native SVG element with a `<title>`, so hovering shows that month's exact dollar figure via the browser's built-in tooltip — no custom interaction code. **Accepted limitation**: native `<title>` tooltips are mouse-hover-only and don't reliably fire on touch devices, even though both pages are already mobile-responsive. This is a deliberate simplicity tradeoff (same reasoning as choosing native tooltips over custom interaction code in the first place), not an oversight — a touch user sees the trend shape but not exact per-month figures in this pass.
- R8. Each point is colored individually by that month's own positive/negative status (not one color for the whole strip) — the point of a trend view is seeing which months were which, and a single blended color would hide that. Uses the same positive/negative convention already established on the Remaining summary card, plus the neutral "awaiting" treatment from R11.

**Historical Data Availability** *(technical requirement discovered during this brainstorm, not anticipated by the original idea — and substantially revised after document review)*
- R9. `allocator.html` computes and persists a "remaining" figure for every month, but **snapshots it at the time the month was last actively viewed, rather than recomputing it fresh from current bill/goal data on every save.** Today, `persist()` only caches `state.summary` for `state.currentMonthKey`; historical months hold only raw income/entries with no cached figure. The original plan for this requirement — recomputing every historical month from scratch on every `persist()` call — was rejected during document review: bills and goals are global lists, not versioned per month, so a full recompute would silently rewrite past months' figures every time a bill or goal is edited or deleted today, even retroactively into months before that bill existed. The resolved design instead extends the *existing* behavior (a month's figure is only (re)computed while it's the currently-viewed month) to also write that figure into a permanent `state.history` record each time — a month's entry is written only while it's current, and freezes the moment the user navigates away from it. This gives "as it stood when you last worked on that month" semantics without needing to version bill/goal definitions themselves.
- R9a. **One-time backfill for existing history**: months that existed before this feature ships have no prior snapshot to freeze, since the concept didn't exist yet. On first load after this ships, compute a best-effort snapshot for every existing month key using *current* bill/goal definitions — the only data available — and write it to `state.history`. This is an accepted, explicit limitation of the migration itself: months never revisited after this ships got their one-time snapshot from today's definitions, not from whatever was true when they were actually current. Going forward, the freeze-on-navigate-away behavior (R9) takes over and this limitation doesn't recur.
- R9b. This backfill (R9a) must run on `allocator.html` load regardless of whether the user performs a write action — not only inside `persist()`, which is triggered by edits. Reviewers confirmed the plain load-time `persist()` call today is gated behind `if (!state.currentMonthKey)` and won't fire for a returning user who already has a `currentMonthKey` set, meaning an existing multi-month user could otherwise open the updated `index.html` and see an empty trend strip until they happened to make an edit in `allocator.html` first — directly undermining the stated success criterion of not needing to open `allocator.html` first.
- R10. `index.html` continues to have zero verdict-computation logic of its own — an unchanged invariant from the prior session. It only reads the persisted history data, matching the same "`allocator.html` computes and persists, `index.html` reads plain numbers" pattern already established for the current month's summary.
- R11. A month whose status is `awaiting` (income not yet fully entered) still gets a `state.history` entry, but with no numeric `remaining` — the trend strip renders it as a distinctly-styled neutral point (matching the existing `.awaiting` visual treatment already used elsewhere), not skipped and not shown as `$0`, consistent with how the app already avoids implying a false "you're fine" state for incomplete data.

## Success Criteria
- Opening `index.html` shows a trend line of the Remaining figure for however many months of real history exist, without needing to open `allocator.html` and page through months manually.
- Hovering any point on the trend strip shows that month's exact dollar figure.
- The shared chart script introduces no build step, no external dependency, and no change to either page's existing "fully self-contained" loading pattern beyond the one new `<script src>` tag on `index.html`.

## Scope Boundaries
- `bar()` and `donut()` are implemented but not wired into any real UI in this pass — no category-breakdown chart, no per-paycheck-breakdown chart ships here. Those are separate ideation survivors (#3 and #5), to be brainstormed separately when picked up.
- No shared "theme" abstraction — the primitive takes explicit colors per call.
- Trend strip only plots "Remaining" — no toggle for income/bills, no multi-line view. An explicit choice made during this brainstorm, revisitable later.
- No changes to `allocator.html`'s own UI/rendering beyond the history-snapshot computation (R9-R9b) — it gains no new visible chart itself in this pass.
- Does not merge or restructure the two-page architecture (edit vs. summary split), which was deliberately shipped and confirmed in the prior session.
- No custom touch/keyboard interaction for exact-value lookup on the trend strip in this pass (see R7's accepted limitation) — desktop hover is the only precise-value path for now.
- Historical figures for months never revisited after this ships reflect a one-time best-effort backfill from current bill/goal definitions (R9a), not true point-in-time accuracy — an accepted limitation of the migration, not a bug to chase.

## Key Decisions
- **Paired the primitive with a real consumer (the trend strip) rather than building it standalone** — avoids designing an API from guesses. The sparkline is a genuine SVG-drawing case (points + a line path), unlike goal-progress-bars, which could be done with pure CSS width percentages and wouldn't have exercised real chart-rendering logic. A plain text/CSS list was implicitly considered and rejected for the same reason: a connected trend line is qualitatively different information from a list of numbers, and is the actual point of this idea.
- **All three primitive functions are built now**, even though only `sparkline()` has a real caller — reconsidered explicitly during document review (two independent reviewers flagged this as contradicting the document's own "no caller, no value" principle) and confirmed a second time: front-loading the shared-file API design in one pass rather than revisiting it repeatedly. Accepted risk: `bar()`/`donut()` may need real rework once a genuine consumer (category or per-paycheck breakdown) is built against them.
- **Trend strip plots Remaining only** — keeps the first pass visually simple and reuses the one number the 3-card summary already treats as the headline figure.
- **Up to 6 months, showing whatever exists** — no artificial minimum-history gate, so the feature is visible and useful even on a freshly-adopted app with only 1-2 months of real data. Zero months hides the section; a single month renders as a lone point.
- **Native SVG `<title>` tooltips, not custom hover UI** — zero extra interaction code for exact-value lookup, with the explicit, documented tradeoff that touch users get the trend shape but not precise per-month figures in this pass.
- **Per-point coloring, not one color for the whole strip** — a trend view exists specifically to show which months differed from others; blending to one color would defeat that purpose.
- **Colors are caller-supplied, not hardcoded** — matches the two pages' already-distinct visual identities.
- **Only `index.html` loads the shared script in this pass** — `allocator.html` has no real consumer yet.
- **Historical figures are snapshotted when a month is last actively viewed, not recomputed fresh from live data on every save** — reversed from the original plan during document review. A reviewer traced the actual code and confirmed bills/goals are global, unversioned lists; recomputing every historical month from current definitions on every save would silently rewrite past months' figures whenever a bill or goal changes today. The resolved design extends the *existing* "only the currently-viewed month gets computed" behavior to also freeze that figure into permanent history once the user navigates away, giving "as it stood when last touched" semantics without needing to version bill/goal data itself.
- **A one-time backfill computes best-effort history for pre-existing months on first load after this ships** (R9a), and this backfill must run unconditionally on load, not only inside `persist()` (R9b) — otherwise a returning multi-month user could see an empty trend strip until their next edit, contradicting the "no need to open allocator.html first" success criterion.
- **`awaiting`-status months get a distinctly-styled neutral point, not skipped and not `$0`** (R11) — consistent with how the app already avoids implying a false "you're fine" reading for incomplete data.

## Dependencies / Assumptions
- Builds on the unified `budget-v1` data model and `computeMonthVerdict`/`persist()` pattern from `docs/plans/2026-08-10-003-feat-unified-budget-data-plan.md`.
- Assumes `state.months{}` keys are reliably parseable `"YYYY-MM"` strings for selecting/sorting the most recent N months — already true of the existing `monthKeyOf`/`shiftMonthKey` conventions in `allocator.html`.
- This is idea #7 from `docs/ideation/2026-08-11-review-portals-and-breakdown-visuals-ideation.md`. The other 6 survivors remain unexplored; several (category breakdown, per-paycheck breakdown, goal health board) would become the real consumers that validate or invalidate the accepted risk around `bar()`/`donut()`.

## Outstanding Questions

### Deferred to Planning
- [Affects R9][Technical] Exact shape/field name for `state.history` (e.g. `{ "YYYY-MM": { remaining, status } }` vs. an array) — a data-shape detail, not a product decision.
- [Affects R9b][Technical] Exact trigger point for the unconditional backfill on `allocator.html` load — e.g. a dedicated function called once at module init, separate from the existing gated first-load `persist()` call.
- [Affects R1][Technical] Exact function signatures for `sparkline()`/`bar()`/`donut()` — parameters, and whether each returns an SVG string vs. a DOM node — implementation detail for planning.
- [Affects R5][Needs research] Exact pixel dimensions/placement of the trend strip relative to the existing 3 summary cards — a layout detail.

## Next Steps
-> /ce:plan for structured implementation planning

# Architecture: Budgeting Phase 3b To 3c Handoff

## Status

Provisional handoff. Phase 3b is intentionally being built before all budgeting questions are settled.

## Purpose

This document defines what Phase 3c may consume from Phase 3b, what remains provisional, and what must be reconciled before recommendation acceptance or restriction-aware recommendation behavior is implemented.

## Phase Ownership

### Phase 3b owns

- User-owned budget and allocation persistence.
- Offline-first draft creation and local reads.
- Manual allocation entry.
- Period selection and user-confirmed dates.
- Local transaction-based tracking for provisional display.
- The budgeting repository and its sync path.
- Final budgeting policy reconciliation through `VIB-295`.

### Phase 3c owns

- Online recommendation generation.
- The normalized recommendation contract.
- The `BudgetSuggestionProvider` adapter seam.
- Recommendation explanations, freshness, and status metadata.
- Offline recommendation cache and review.
- Explicit accept, modify, and reject actions.

Phase 3c must not create a parallel budget repository or duplicate budget policy. Accepted or modified recommendations must go through the reconciled Phase 3b budget repository.

## Stable Handoff Contract

The following assumptions are safe for Phase 3c to consume after the relevant 3b work exists:

- Budgets and allocations are user-scoped.
- Category and subcategory references must belong to the authenticated user.
- Monetary values use the existing integer minor-unit convention.
- Recommendation generation is not performed offline.
- Cached recommendations are derived results and must remain distinguishable from user-authored budgets.
- A recommendation does not automatically replace or mutate an active budget.
- Acceptance is an explicit user action that creates or updates budget data through the budget repository.
- Recommendation output must preserve enough input and freshness metadata to determine whether it is stale.
- Recommendation generation and transport stay behind `BudgetSuggestionProvider.generate(input)`.

## Provisional 3b Decisions

These decisions are deliberately manual defaults for the first implementation and must not be treated as final product policy by Phase 3c:

- `allocation_method` is `MANUAL`.
- All four period kinds are selectable: `WEEKLY`, `MONTHLY`, `CUSTOM`, and `INCOME_CYCLE`.
- Dates are always confirmed by the user.
- `surplus_handling` is `LEAVE_UNALLOCATED`.
- `deficit_handling` is `BLOCK_ACTIVATION`.
- Deficit planning is disabled.
- Existing `PROTECTED` and `FIXED` category statuses are not changed, but both behave as `OPEN` during provisional validation.
- Amounts must be positive integer minor units.
- No overlapping active budgets is the provisional overlap rule.
- Drafts can be created, listed, read, and deleted; editing, superseding, and activation are deferred.
- No formal budget health status or health snapshot is exposed.
- Tracking is a display-only provisional percentage:

  `actual_expenses_for_category / allocation_amount * 100`

- If an activation seam is needed later, the provisional rule is to block when current available balance is less than the budget total. This rule is explicitly not final.

## Reconciliation Required Before 3c Acceptance

`VIB-295` blocks Phase 3c recommendation acceptance and restriction-aware behavior. Before those parts of 3c begin, settle and encode the following:

- How `PROTECTED` floors are set, omitted, changed, and snapshotted.
- Whether `FIXED` amounts come only from users or also obligations/recurring expenses.
- Whether default protected categories are mandatory in every budget.
- Exact surplus and deficit semantics, destinations, confirmation, and carry-forward behavior.
- Whether `REDUCE_OPEN` is advisory or mutating.
- Allocation methods beyond manual entry, including percentage and historical baseline behavior.
- Budget editing, activation, closure, archive, deletion, and superseding semantics.
- Whether active budget edits create versions/events and how existing actuals are interpreted.
- Final health formulas, thresholds, precedence, transaction statuses, refunds, reversals, and transfers.
- Whether recommendation feasibility allows unallocated funds, savings goals, debt, or deficit planning.
- Required recommendation output fields, explanation rules, freshness labels, and status transitions.
- Whether accepted recommendations are immutable snapshots before creating a draft.

## Required 3c Guardrails

- Do not implement acceptance against provisional `OPEN` treatment for protected/fixed categories.
- Do not independently define floors, ceilings, deficit rules, or health formulas in the recommendation module.
- Do not silently convert a recommendation into an active budget.
- Do not overwrite the original recommendation when a user modifies or accepts it.
- Revalidate the recommendation against the reconciled budget rules before acceptance.
- Keep generated recommendations separate from ordinary user CRUD and sync them only according to the approved recommendation boundary.
- Treat cached recommendations as viewable but stale when their source budget, restrictions, or transactions changed.

## Handoff Checklist

### Before starting 3c contract work

- [ ] VIB-293 draft persistence is implemented and tested.
- [ ] VIB-294 provisional tracking is implemented and labeled not final.
- [ ] The budget repository seam is documented and callable without UI knowledge.
- [ ] The provisional formulas live in `apps/app/features/budgeting/constant.ts`.
- [ ] Recommendation input/output fixtures explicitly mark unresolved policy fields.

### Before implementing 3c acceptance

- [ ] VIB-295 is complete.
- [ ] VIB-295 is marked complete in Linear and its block on VIB-158 is cleared.
- [ ] Final restriction and feasibility rules are in the budgeting constants/repository.
- [ ] Acceptance creates a draft or other explicitly approved result, never an active-budget mutation.
- [ ] Recommendation acceptance and modification tests use the reconciled budget rules.

## Related Work

- [VIB-164 execution plan](../../plans/vib-164-execution-plan.md)
- [VIB-158 execution plan](../../plans/vib-158-execution-plan.md)
- [Budgeting implementation details](../requirements-engineering/budgetting-implementation-details.md)
- [Budgeting implementation questions](../requirements-engineering/budgetting-implementation-details-questions.md)
- [VIB-164](https://linear.app/vibe-coders-odin/issue/VIB-164/phase-3b-budgets-and-allocations-offline-first)
- [VIB-158](https://linear.app/vibe-coders-odin/issue/VIB-158/phase-3c-budget-recommendations-cached-execution)

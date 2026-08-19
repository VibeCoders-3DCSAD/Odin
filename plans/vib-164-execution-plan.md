# VIB-164 Execution Plan

## Goal

Deliver Phase 3b incrementally, starting with an offline-first manual budget draft, then adding provisional category tracking, and finally reconciling the implementation after the open budgeting questions are answered.

## Source Of Truth

- Linear: https://linear.app/vibe-coders-odin/issue/VIB-164/phase-3b-budgets-and-allocations-offline-first
- PRD: `docs/requirements-engineering/budgetting-implementation-details.md`
- Open questions: `docs/requirements-engineering/budgetting-implementation-details-questions.md`
- Remote schema: `supabase/migrations/20260616064145_priority_modules_v3.sql`
- Local database: `apps/app/local-db/`
- Existing sync pipeline: `apps/app/local-db/sync/` and `apps/api/src/services/`

## Non-Goals

- No recommendations, optimizer, ML, or forecast integration.
- No formal budget health statuses, health snapshots, or 90% thresholds before reconciliation.
- No protected/fixed enforcement; existing category statuses remain unchanged but behave as `OPEN` in the provisional slices.
- No active-budget editing, superseding, activation, rollover execution, or deficit execution in the initial implementation.
- No strategy configuration before its product meaning is settled.
- No new dependencies, sync engine, or generic data layer.

## Execution Order

1. Implement VIB-293: create offline budget drafts.
2. Implement VIB-294: add provisional tracking and the minimal UI.
3. Stop and gather answers to the open questions.
4. Implement VIB-295: reconcile the provisional module with settled rules.
5. Only after VIB-295 is complete, begin Phase 3c recommendation acceptance and restriction-aware behavior.
## PR Stacking Strategy

Use one working branch and audit uncommitted changes between phases instead of opening a PR for every sub-issue.

```text
current base
└─ feat/vib-164-budgeting
   ├─ Phase 3b.1: VIB-293 draft creation
   ├─ Phase 3b.2: VIB-294 provisional tracking and UI
   └─ Phase 3b.3: VIB-295 reconciliation
```

Suggested workflow:

```bash
git switch -c feat/vib-164-budgeting
# implement VIB-293
# audit uncommitted changes
# implement VIB-294
# audit uncommitted changes
# settle the open questions
# implement VIB-295
# run the full audit and verification suite
```

If commits are useful, keep them on the same branch and use the issue IDs in the messages. Separate PRs are not required.

## Linear Sub-Issue Tracking

- `VIB-293`: Phase 3b.1, create offline budget drafts.
- `VIB-294`: Phase 3b.2, track draft budgets locally and add the minimal UI.
- `VIB-295`: Phase 3b.3, reconcile the module after the open questions are settled.
- `VIB-296`: canceled because a formal health-cache phase is premature.
- `VIB-297`: reduced to support work and folded into VIB-294.
- VIB-295 blocks VIB-158. Phase 3c contract discovery and fake-provider work may start earlier, but recommendation acceptance must wait for reconciliation.

### 1. Create Offline Budget Drafts

- Touch `apps/app/local-db/migrations/016_budgets.ts`, `apps/app/local-db/client.ts`, `apps/app/local-db/types.ts`, and add `apps/app/local-db/repositories/budgets.ts`.
- Add only the local `budgets` and `budget_allocations` data needed for drafts, with user ownership, versions, tombstones, timestamps, and sync metadata.
- Support `MANUAL` allocation, all four period selectors (`WEEKLY`, `MONTHLY`, `CUSTOM`, `INCOME_CYCLE`), user-confirmed dates, `LEAVE_UNALLOCATED`, `BLOCK_ACTIVATION`, and disabled deficit planning.
- Validate positive integer minor-unit amounts, valid dates, accessible category/subcategory references, allocation scope, and user ownership.
- Treat all allocation restrictions as `OPEN` for validation without modifying the source category restriction records.
- Create/list/read/delete drafts and their allocations transactionally; enqueue existing sync operations in the same transaction.
- Do not implement editing, activation, superseding, health, recommendations, strategy configs, or restriction changes.

### 2. Add Provisional Tracking And UI

- Touch `apps/app/features/budgeting/constant.ts`, add the budgeting feature screen/components, and update `apps/app/components/MobileShell.tsx` only for the navigation entry point.
- Keep every provisional formula and constant in `constant.ts`; do not duplicate formulas in repositories or JSX.
- Show draft total, allocated amount, unallocated amount, allocations, and locally posted expense totals by category.
- Calculate and display the explicitly provisional percentage:

  `actual_expenses_for_category / allocation_amount * 100`

- Label the percentage as provisional/not final. Avoid calling it budget health or adherence.
- Make local saves immediately visible and trigger existing sync opportunistically without blocking the local write.
- Add focused repository/UI tests and an offline smoke flow: create draft -> reopen draft -> view provisional tracking.
- If an activation seam is required for later work, keep the provisional rule in `constant.ts`: block when current available balance is less than the budget total. Mark it not final and do not expose activation yet.

### 3. Reconcile The Budgeting Module

- Re-read `docs/requirements-engineering/budgetting-implementation-details-questions.md` and record the settled decisions before changing behavior.
- Update `apps/app/features/budgeting/constant.ts` as the single source for final formulas, thresholds, enum defaults, and rule metadata.
- Reconcile schema, local repositories, sync allowlists/RPC validation, UI, and tests for protected/fixed floors, surplus/deficit handling, allocation methods, lifecycle/editing, health, and recommendation boundaries.
- Add only the final behavior that the answers justify; do not preserve provisional rules merely for compatibility unless persisted data requires it.
- Update the PRD/questions documentation if decisions changed the stated contract.
- Run the full API, app, repository, sync, and offline/reconnect verification suite.

## Acceptance Criteria

- A signed-in user can create a budget draft offline with a manually entered total, selected period kind, and confirmed date range.
- The period selector exposes `WEEKLY`, `MONTHLY`, `CUSTOM`, and `INCOME_CYCLE`.
- Draft allocations reference only accessible local categories/subcategories and use positive integer minor-unit amounts.
- Existing protected/fixed source statuses are not modified and are treated as `OPEN` during provisional validation.
- Draft totals and unallocated amounts are visible locally immediately.
- Provisional category expense percentages use the single formula in `constant.ts` and are clearly marked not final.
- No formal budget health status or recommendation is presented before reconciliation.
- Sync operations remain user-scoped, transactional, idempotent, and compatible with the existing queue.
- After the open questions are settled, the reconciliation phase updates behavior and tests to the agreed rules.
- The finalized budgeting repository and constants become the source of truth for Phase 3c recommendation feasibility and accepted-budget creation.

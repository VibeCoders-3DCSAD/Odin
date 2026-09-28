# Savings Goal Envelope Allocation Execution Plan

## Goal

Distribute Budgeting's existing current-cycle Savings Envelope across active Goal
Savings accounts as a transparent proposal: satisfy scheduled minimums first,
prioritize an unmet Emergency Fund, then use the user's Avalanche or Snowball
strategy for surplus. The proposal never changes a balance or creates a transfer;
each proposed contribution requires the user to explicitly open, review, and save
the existing transaction flow.

## Source Of Truth

- Requirements: `docs/requirements-engineering/features/08-savings-accounts-module.md`, sections 8.10-8.12.
- Existing envelope and budget-period owner: `apps/app/local-db/repositories/budgets.ts` and `apps/app/features/budgeting/BudgetingScreen.tsx`.
- Existing goal schedules and cycle requirements: `apps/app/features/savings-goals/contributionSchedule.ts` and `apps/app/features/savings-goals/requiredSavingsContributionQueries.ts`.
- Allocation precedent: `apps/app/features/debt-manager/debtRepaymentAllocation.ts` and `apps/app/local-db/repositories/debtRepaymentPlans.ts`.
- Existing goal activity-to-transaction route: `apps/app/features/savings-goals/SavingsGoalsScreen.tsx`, `apps/app/components/MobileShell.tsx`, and `apps/app/features/ledger/NewTransactionScreen.tsx`.
- Sync boundaries: `apps/app/local-db/types.ts`, `apps/app/local-db/sync/pullConvergence.ts`, `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, and `supabase/migrations/`.

## Non-Goals

- Do not move money, create a savings activity, or mutate a goal balance merely by calculating, displaying, or approving an allocation proposal.
- Do not change the Budgeting-owned `savings_budget_amount_minor` envelope or the existing category/debt budget rules.
- Do not allocate to Personal Savings, HYSA, Time Deposit, archived goals, deleted goals, achieved goals, or goals without a valid required-contribution schedule.
- Do not persist a snapshot of computed allocation results; recompute the proposal from the current budget, goals, activities, and strategy whenever any input changes.
- Do not deploy the required Supabase migration without explicit user approval.

## Execution Order

## PR Stacking Strategy

Keep the strategy preference and its sync contract below the pure allocation
engine and UI, so every client can preserve the chosen strategy before consuming
it in a proposal.

```text
main
└─ feat/savings-allocation-preference
   └─ feat/savings-envelope-proposals
      └─ feat/savings-allocation-approval-ui
```

```bash
git switch -c feat/savings-allocation-preference
git switch -c feat/savings-envelope-proposals
git switch -c feat/savings-allocation-approval-ui
```

Merge the preference contract first, then the pure engine/query integration, then
the review-and-approve presentation. Keep migrations and every sync allowlist in
the same atomic PR; do not split a client queue contract from its API/RPC/pull
support.

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready:
strategy preference and sync; pure allocation proposal; review/approval UI and
verification.

### 1. Persist The User's Savings Allocation Strategy

- Add `apps/app/local-db/migrations/060_savings_allocation_preferences.ts`, register it in `apps/app/local-db/client.ts`, and add `apps/app/local-db/repositories/savingsAllocationPreferences.ts`. Store one user-owned `savings_allocation_preferences` record with `strategy` constrained to `avalanche` or `snowball`, version, tombstone, and timestamps; default a missing record to Avalanche without silently writing a preference.
- Add the matching forward `supabase/migrations/<timestamp>_add_savings_allocation_preferences.sql` migration, then extend `apps/app/local-db/types.ts`, `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, and `apps/app/local-db/sync/pullConvergence.ts`. The repository write and queue entry must be one local transaction, all reads/writes must use `user_id`, and the remote RPC must validate the narrow payload and version semantics before applying it.

### 2. Build One Pure, Centavo-Safe Allocation Proposal Engine

- Add `apps/app/features/savings-goals/savingsEnvelopeAllocation.ts` and `apps/app/features/savings-goals/savingsEnvelopeAllocationQueries.ts`. The query loads the selected current budget, its inclusive period, active goals, activities, and the strategy in bounded batches, then passes plain records to the pure engine; it must not query a goal inside a loop or read auth globals.
- Reuse `getRequiredSavingsContributions` as the sole source for each goal's current-cycle remaining required amount. Allocate a non-negative envelope in this order: Emergency Fund required amounts first, non-Emergency required amounts ordered by the selected strategy, then surplus using the same Emergency Fund-first rule and strategy. Avalanche orders by largest current-cycle shortfall, then earliest target date, then ID; Snowball orders by smallest remaining goal amount, then earliest target date, then ID; cap every proposal at the goal's remaining amount and retain unallocated envelope when all eligible goals are fully funded.
- Return a stable per-goal proposal containing required, recorded, proposed required, proposed surplus, total proposed, unfunded required, state (`funded`, `partially_funded`, or `unfunded`), and ordered reason codes. Reason text belongs in the presentation layer, but the engine must expose enough reason codes to distinguish Emergency Fund priority, scheduled minimum, Avalanche surplus, Snowball surplus, and no available envelope.

### 3. Surface The Proposal At The Budget And Savings Boundaries

- Update `apps/app/features/budgeting/BudgetingScreen.tsx` to link or navigate from the saved/current Savings Envelope to Savings Goals allocation review, preserving the budget's selected period and never duplicating envelope entry or ownership in Savings Goals.
- Refactor `apps/app/features/savings-goals/SavingsGoalsScreen.tsx` into focused allocation presentation components as needed, such as `SavingsAllocationReview.tsx` and `SavingsAllocationRow.tsx`. Show the envelope amount, total required, shortfall or remaining surplus, selected strategy, each eligible goal's proposed amount/state/reason, and clear empty states for no current budget, zero envelope, no eligible goals, and no complete schedules.
- Add an explicit Avalanche/Snowball selector backed by `saveSavingsAllocationStrategy`; changing it recalculates the proposal and affects no money movement. Explain that a proposal is planning guidance until the user records a contribution, and that recorded contributions refresh the proposal rather than being overwritten.

### 4. Make Approval An Explicit Transaction Boundary

- Extend the Savings Goal allocation row action to open the existing contribution context through `apps/app/components/MobileShell.tsx` and `apps/app/features/ledger/NewTransactionScreen.tsx`, passing the selected goal and proposed amount as a prefill only. Keep source account selection, date, notes, transfer validation, and the final save confirmation in Transaction Management; the user may change or cancel the amount before saving.
- Do not add an approval-only persistence record: a proposal is approved only by successfully saving its explicit linked contribution transaction. After save, existing savings-activity synchronization updates the goal balance and the allocation query recomputes from the new recorded contribution; cancellation or validation failure creates no activity and leaves the proposal unchanged.

### 5. Verify Allocation, Sync, And Approval Behavior

- Add pure-engine tests in `apps/app/features/savings-goals/__tests__/savingsEnvelopeAllocation.test.ts`. Cover zero/negative-normalized envelopes, no eligible goals, already achieved goals, all three funding states, recorded contributions reducing required funding, Emergency Fund priority under a shortfall and surplus, Avalanche ordering by shortfall, Snowball ordering by remaining amount, deterministic ties, caps at goal remaining amount, and unallocated remainder.
- Add repository, API, and pull-convergence tests for the strategy preference: invalid strategy rejection, user isolation, create/update/tombstone queue payloads, remote ownership checks, version conflicts, and second-device convergence. Add UI tests for budget-to-review navigation, strategy selection, explanations, item-scoped pending state, empty states, and the explicit contribution prefill/cancel/save paths.
- Add `apps/app/maestro/savings-envelope-allocation.yaml` after inspecting installed selectors. Exercise a budget with an envelope, an Emergency Fund and two other scheduled goals, verify the ordered proposal/reasons, choose a row, cancel once, then save a contribution and verify the recalculated result. Run `pnpm --filter app test -- --runInBand`, `pnpm --filter app exec tsc --noEmit`, `pnpm --filter api test`, `pnpm test`, the focused Maestro flow, `supabase migration list --linked`, and `supabase db push --dry-run`; do not deploy the migration.

## Acceptance Criteria

- Budgeting remains the sole owner of the current-cycle Savings Envelope, and Savings Goals consumes it read-only for a selected inclusive budget period.
- A user can select Avalanche or Snowball once, and their choice synchronizes safely across devices under their `user_id`.
- Every active eligible Goal Savings account receives a deterministic proposal with a funded, partially funded, or unfunded state and a plain-language reason.
- Emergency Fund required funding is considered before every other goal; surplus allocation follows the selected strategy after required amounts are addressed.
- Avalanche uses the largest current-cycle shortfall and Snowball uses the smallest remaining goal amount, with stable documented tie-breakers.
- A proposal never changes a goal balance, creates a transaction, or creates a savings activity. Only an explicit transaction review and save can record the suggested contribution.
- Cancelling or editing a prefilled proposed contribution does not persist an approval. A saved contribution updates the existing activity history and causes the current proposal to recompute.
- The strategy preference's local schema, queue payload, API validation, remote RPC handler, remote pull list, and local pull convergence are all updated and user-scoped before the feature is considered complete.

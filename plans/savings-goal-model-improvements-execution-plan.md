# Savings Goal Model Improvements Execution Plan

## Goal

Evolve the existing offline-first Savings Goal CRUD slice into a typed, user-scoped Goal Savings model with lifecycle-aware progress, Emergency Fund target methods, and explicit transaction-linked contributions and withdrawals. The implementation keeps a Goal Savings record as its own holding account and derives its current balance from its opening balance plus active linked activity, rather than adding a separate financial-account link or silently interpreting ordinary transactions as savings activity.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/feature-modules.md`, sections 8.1-8.10 and 8.16-8.17.
- Existing goal persistence and sync contract: `apps/app/local-db/migrations/051_savings_goals.ts`, `apps/app/local-db/repositories/savingsGoals.ts`, `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, `apps/app/local-db/sync/pullConvergence.ts`, and `supabase/migrations/20261002000012_add_savings_goal_sync.sql`.
- Existing goal UI: `apps/app/features/savings-goals/SavingsGoalsScreen.tsx` and `apps/app/features/savings-goals/SavingsGoalForm.tsx`.
- Transaction-entry and transaction-linked debt-payment precedents: `apps/app/features/ledger/NewTransactionScreen.tsx`, `apps/app/local-db/repositories/ledger.ts`, and `apps/app/local-db/repositories/debtPayments.ts`.
- Existing Emergency Fund baseline behavior: `apps/app/features/savings-goals/emergencyFundBaseline.ts`.

## Non-Goals

- Do not implement Regular Savings, High-Yield Savings, or Time Deposit accounts in this slice; their account-specific fields and early-withdrawal rules need their own persistence contract.
- Do not implement Savings Envelope allocation, Avalanche/Snowball distribution, projection generation, reminders, alerts, credited interest, or recurring-transaction execution.
- Do not create a separate `financial_accounts` record or link a Goal Savings record to one.
- Do not infer savings activity from ordinary transactions, alter existing transactions without user action, or automatically replace an approved Emergency Fund target after essential expenses change.
- Do not deploy a Supabase migration without explicit user approval.

## Execution Order

## PR Stacking Strategy

Ship the model before presentation, then add the transaction boundary only after the schema and sync contract can preserve activity history across devices.

```text
main
└─ feat/savings-goal-model
   ├─ feat/savings-goal-activity-sync
   └─ feat/savings-goal-progress-ui
```

```bash
git switch -c feat/savings-goal-model
```

Merge the model branch first, then the activity-sync branch, then the UI branch. Keep the migration and every sync allowlist in the activity-sync PR so no client can queue an entity that the API, RPC, or pull path cannot process.

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready: goal model and migration; savings activity sync and transaction routing; progress UI and verification.

### 1. Establish The Goal Savings Domain Types And Pure Model

- Add `apps/app/features/savings-goals/types.ts` and `apps/app/features/savings-goals/savingsGoalModel.ts`; move the Goal-specific unions from `constants.ts` into types for `SavingsGoalCategory`, `SavingsGoalPriority`, `SavingsGoalStatus`, `EmergencyFundTargetMethod`, `SavingsActivityKind`, record inputs, and computed progress views.
- Make the model pure and centavo-safe: calculate active balance, non-negative remaining amount, primary progress capped to `0..100`, achieved/active state, and the contribution shortfall supplied by a caller-owned cycle range. Use standard half-up rounding for all money results, derive `achieved` when the balance reaches target, and return an achieved goal to `active` after a withdrawal drops it below target.
- Preserve current persisted records by mapping legacy `goal_type` values to the new goal category during migration; Emergency Fund remains a category, never an account type or a debt. Keep placeholder/label maps in `constants.ts` as presentation-only data and require exhaustive records for every domain union.

### 2. Extend The Goal Record And Emergency Fund Configuration

- Add local migration `apps/app/local-db/migrations/053_savings_goal_model.ts`, register it in `apps/app/local-db/client.ts`, and add the matching forward Supabase migration. Extend the existing `savings_goals` record with `goal_category`, `auto_save_amount_centavos`, optional `interest_rate_bps`, optional `notes`, `emergency_fund_target_method`, optional `essential_expense_coverage_months`, and `archived_at`; retain the existing opening balance field as the goal's initial balance and allow the persisted lifecycle only as `active`, `archived`, or `deleted`.
- Backfill existing `goal_type` into `goal_category`, use `fixed_amount` for existing Emergency Fund goals, and preserve their saved target/baseline exactly. Require a target date for new or edited goals, while retaining legacy null dates for read-only display until the user edits that record; validate bounded text, safe centavo integers, non-negative interest basis points, a positive target, and Essential-Expense Coverage only for Emergency Fund with a coverage period of 3 through 6 months.
- Update `apps/app/local-db/repositories/savingsGoals.ts` so `SavingsGoal`, create/update input, local payload, row mapping, archive/restore operations, and all user-scoped reads share the new typed contract. The model exposes `achieved` as a calculated progress state rather than a separately mutable lifecycle value; the form may request a refreshed essential-expense suggestion, but only an explicit save changes the selected target and later expense changes must not mutate a goal.

### 3. Add Savings Activity As A First-Class Syncable Record

- Add `savings_goal_activities` through the same local and remote migrations, with UUID identity, `user_id`, `savings_goal_id`, `transaction_id`, activity kind (`contribution` or `withdrawal`), amount, activity date, version, tombstone, and timestamps. Enforce one owned goal and one owned transaction per activity, require positive whole-centavo amounts, and use a unique active transaction link so retrying a saved transaction cannot create duplicate activity.
- Add `apps/app/local-db/repositories/savingsGoalActivities.ts` with user-scoped list/get/create/delete-correction helpers and a batch query used by the goal detail/list loaders. Activity mutations and their queue entries must share one SQLite transaction; corrections soft-delete the activity and never hard-delete history needed for sync convergence.
- Extend `SyncableEntity`, local queue ordering where an activity depends on its transaction, API `SYNCED_ENTITIES`, create/update allowlists and ownership validation, API `SYNCED_TABLES`, local pull `SYNCED_TABLES`/`LOCAL_COLUMNS`, and the private Supabase RPC handlers. Use a forward migration to add the remote entity to its allowlist and handler, validate it with `supabase migration list --linked` and `supabase db push --dry-run`, and do not deploy it yet.

### 4. Route Explicit Contribution And Withdrawal Transactions

- Add `source_savings_goal_id` and `destination_savings_goal_id` to the local and remote `transactions` contract, then extend `apps/app/local-db/repositories/ledger.ts`, transaction sync validation, pull convergence, and the private transaction RPC logic to validate one owned endpoint on each side of a Transfer. A valid savings contribution transfers from an eligible financial account to a Goal Savings holding record; a valid withdrawal transfers from that Goal Savings holding record to an eligible financial account, with no separate `financial_accounts` record for the goal.
- Add a `SavingsActivityContext` to `apps/app/features/ledger/NewTransactionScreen.tsx` and wire it through `apps/app/components/MobileShell.tsx`; Savings Goals launches Transaction Management with the selected goal and chosen activity, while Transaction Management continues to own amount, date, account, recurrence, and notes inputs. The ledger must update financial-account balances only for financial endpoints and let the Savings Goal model derive its holding balance from its linked activity, preventing the current two-financial-account transfer validation from rejecting a valid savings transfer.
- Create or update the linked `savings_goal_activities` row in the same local transaction as its transfer and queue its operation after the transaction operation. Reuse the debt-payment pattern only for orchestration, not its expense-specific data model; a confirmed activity correction soft-deletes both the activity and its linked transaction atomically, while transaction edits update the activity amount/date atomically.

### 5. Present Lifecycle, Progress, And Activity History

- Refactor `apps/app/features/savings-goals/SavingsGoalsScreen.tsx` into small list, detail, and activity components, and update `SavingsGoalForm.tsx` to collect category, target, target date, auto-save amount, optional interest rate, priority, notes, and Emergency Fund target-method inputs. Keep current data orchestration thin and source every displayed status/progress value from `savingsGoalModel.ts` rather than duplicating calculations in JSX.
- Show current balance, target, remaining amount, capped progress, status, target date, and separate contribution and withdrawal histories. Achieved and archived goals cannot accept contributions; achieved goals may be reopened only by an eligible withdrawal, while archive/delete actions each use the requirements' explicit confirmation text and item-scoped pending state.
- Add an empty activity state, no-eligible-account state, validation feedback beside affected fields, loading/error recovery states, and the specified savings notices. Preserve valid form input after validation failure and clear individual field errors when corrected.

### 6. Verify The Complete Local-First Contract

- Add pure-model tests at `apps/app/features/savings-goals/__tests__/savingsGoalModel.test.ts` for centavo half-up rounding, progress bounds, remaining amount, achieved/reactivation transitions, shortfalls, excluded deleted activities, and Emergency Fund fixed versus coverage suggestions. Add repository tests for user isolation, migration backfill, validation, activity uniqueness, local transaction/queue behavior, archived/completed contribution rejection, and batched history loading.
- Extend API and pull-convergence tests for both `savings_goals` fields and `savings_goal_activities`, including payload allowlists, cross-user references, remote tombstones, version conflicts, and second-device convergence. Add React Native tests for form modes, state rendering, activity history, contribution/withdrawal route context, and destructive confirmations; update `apps/app/maestro/savings-goals-crud.yaml` or add a focused activity flow based on inspected selectors.
- Run `pnpm --filter app test -- --runInBand`, `pnpm --filter app exec tsc --noEmit`, `pnpm --filter api test`, and `pnpm test`. Run the focused Maestro flow against an installed build, then run the required Supabase migration checks without deploying.

## Acceptance Criteria

- A user can create and edit a Goal Savings record with a category, positive target, target date, auto-save amount, optional interest rate, priority, and notes; all persisted goal data is scoped by `user_id`.
- An Emergency Fund supports Fixed Amount and Essential-Expense Coverage (3-6 months); the latter suggests a target from current monthly essential expenses but cannot silently overwrite an approved target.
- The goal's balance equals opening balance plus active contributions minus active withdrawals, with no fractional-centavo value; progress is displayed from 0% through 100% and remaining amount never falls below zero.
- A goal automatically presents as achieved at or above its target and returns to active if a withdrawal brings its balance below target.
- Savings Goals can open Transaction Management only through an explicit Contribution or Withdrawal action. Ordinary transactions never create savings activity automatically.
- Contributions and withdrawals each retain a user-owned, syncable transaction link; duplicate links, cross-user goal/transaction references, and new contributions to archived or completed goals are rejected.
- A contribution transfers from an eligible financial account to the Goal Savings holding record, and a withdrawal is a confirmed transfer from the Goal Savings holding record to an eligible destination account.
- Existing saved goals retain their category, target, baseline, balances, and sync history through forward local and remote migrations.
- The local entity contract, queue payload, API validation, RPC handler, remote pull list, and local pull convergence all support every new goal/activity field before the slice is complete.
- Focused model, repository, app, API, sync, TypeScript, and Maestro checks pass; no migration is deployed without approval.

# Savings Goals CRUD Execution Plan

## Goal

Deliver the first Savings Goals vertical slice: offline-first, user-scoped CRUD for manual savings goals plus one default Emergency Fund goal. The Emergency Fund target is initialized to the average of the six most recently completed calendar months of posted expense transactions, calculated as their total expense centavos divided by six; the calculated value is saved as a baseline and never silently replaces a user-approved target later.

## Source Of Truth

- Requirements: `docs/requirements-engineering/feature-modules.md`, sections 8.1-8.10 and 8.16-8.17.
- User scope: create, read, edit, and delete savings goals; default Emergency Fund baseline: `sum(monthly expenses for the past six months) / 6`.
- Local persistence and sync pattern: `apps/app/local-db/repositories/debtAccounts.ts`, `apps/app/local-db/sync/queueOrder.ts`, `apps/app/local-db/sync/pullConvergence.ts`, `apps/api/src/services/syncApplyOperation.ts`, and `apps/api/src/services/syncService.ts`.
- The documented `schema/erd-create-tables.sql` Savings Goals table is future-state reference material, not the runtime sync schema for this slice.
- Existing navigation shell: `apps/app/components/MobileShell.tsx`.

## Non-Goals

- No financial-account linking or holding-account behavior.
- No contributions, withdrawals, transaction links, recurring contributions, or automatic interest/yield.
- No savings allocation, Savings Envelope handling, projections, alerts, archive, or achieved-goal workflows.
- No automatic recomputation of an existing Emergency Fund target when expenses change.
- No additional savings categories beyond the minimal `Emergency Fund` and `Custom` choices required for this CRUD slice.
- Do not reuse the future full Savings Goals ERD table: its required linked subcategory and target date, plus its missing sync version/tombstone fields, conflict with this intentionally minimal slice.

## Execution Order

1. Define the savings-goal record and Emergency Fund baseline calculation.
2. Add the local schema, repository, and transactional sync queue operations.
3. Extend the API and Supabase sync contract in the same forward migration.
4. Build the list, detail, create/edit, and confirmed-delete UI.
5. Add focused repository, sync, UI, and offline smoke coverage.

## PR Stacking Strategy

Use a short stack so each concern is independently reviewable and the frontend consumes a stable local contract.

```text
main
└─ feat/savings-goals-foundation
   ├─ feat/savings-goals-sync          # schema, repository, API, remote RPC
   └─ feat/savings-goals-crud-ui       # screens, navigation, tests
```

Merge `feat/savings-goals-sync` first, then merge `feat/savings-goals-crud-ui` into it. If the team prefers one PR, retain these as separate commits and preserve the same implementation order.

## Linear Sub-Issue Tracking

- Create sub-issues from this plan when ready.
- Suggested split: persistence and sync contract; savings-goal CRUD UI; automated and Maestro verification.

### 1. Define The Minimal Goal Contract And Emergency Baseline

- Add `apps/app/features/savings-goals/constants.ts` and `apps/app/features/savings-goals/emergencyFundBaseline.ts` as the single sources for supported goal categories, priority values, form labels/placeholders, and the baseline formula.
- Persist `name`, `goal_type`, `target_amount_centavos`, `starting_amount_centavos`, optional `target_date`, `priority`, and optional `emergency_fund_baseline_centavos`; expose current amount as the starting amount in this slice, rather than inventing contribution behavior.
- Calculate the default baseline from active, posted `expense` transactions whose transaction dates fall in the six completed calendar months before goal creation; include zero-spend months, sum centavos, and divide by six using integer centavo rounding. Store the resulting suggestion and target at creation time, show its source in the form, and require an explicit user edit to change that target.
- On the first savings-goal visit, offer a prefilled Emergency Fund form rather than silently inserting a record; the user explicitly saves the default goal. This preserves the requirements' creation state and avoids creating financial data without confirmation.

### 2. Add Offline-First Local CRUD

- Add `apps/app/local-db/migrations/051_savings_goals.ts`, register it in `apps/app/local-db/client.ts`, and add `apps/app/local-db/repositories/savingsGoals.ts`.
- Create a new user-scoped runtime `savings_goals` table with UUID identity, `name`, `goal_type`, target and starting centavos, optional target date, priority, optional Emergency Fund baseline, status/tombstone fields, version, timestamps, and an index for active goals by user. Do not alter or implement against the incompatible future-state ERD definition; all list, detail, update, and delete queries must include both `user_id` and `id` where applicable.
- Implement `listSavingsGoals`, `getSavingsGoal`, `getEmergencyFundBaseline`, `createSavingsGoal`, `updateSavingsGoal`, and soft-delete functions. Validate trimmed names, the two allowed goal types, positive whole-centavo targets, non-negative starting amounts, valid ISO dates, and valid priorities; run writes and `enqueueOperation` together in a local transaction.
- Add `savings_goals` to the existing `SyncableEntity` contract only if absent after rebasing, then use the exact field names selected for the remote contract. A delete must produce a tombstone and a delete queue item, not a local hard delete.
- Update `apps/app/local-db/sync/queueOrder.ts` to add SQLite `rowid` after `created_at` as the final ordering tie-breaker, and include it in `QueueRow` selection only if needed by the query. Savings goals share the fallback entity priority, so insertion order then deterministically preserves create -> update -> delete even when rapid mutations share the same timestamp; do not order these operations by random `operation_id`.

### 3. Complete The API And Supabase Sync Contract

- Update `apps/api/src/services/syncApplyOperation.ts` with `savings_goals` in `SYNCED_ENTITIES`, narrow create/update field allowlists, payload validation that rejects invalid enums, amount values, and dates, and user-scoped reads when validating an update.
- Add a forward `supabase/migrations/<timestamp>_add_savings_goal_sync.sql` migration that creates the new minimal remote table with the local record's exact fields, user ownership, check constraints, indexes, RLS policy, and sync `version`/`deleted` columns. Extend `private.apply_sync_operation_ledger_core`, which is the active generic handler behind public `apply_sync_operation`, with a `savings_goals` branch; it must validate caller-owned records on update/delete, apply version conflict semantics, and create/update/delete tombstones idempotently.
- Update both pull halves: add `savings_goals` to `apps/api/src/services/syncService.ts` `SYNCED_TABLES` and its user-scoped table branch so another device can fetch it, then add it to `apps/app/local-db/sync/pullConvergence.ts` `SYNCED_TABLES` and `LOCAL_COLUMNS` with its tombstone status behavior. Do not rely on the existing local `SyncableEntity` union alone; every local, API, and RPC allowlist must be extended in the same change.
- Verify the remote migration state with `supabase migration list --linked` and validate it using `supabase db push --dry-run`; do not deploy the migration without explicit approval.

### 4. Build The Savings Goal CRUD Experience

- Add focused components under `apps/app/features/savings-goals/`: `SavingsGoalsScreen.tsx` for data orchestration and empty/list/detail states, `SavingsGoalForm.tsx` for create/edit, and small presentational goal-card/detail components only where they reduce duplication.
- Update `apps/app/components/MobileShell.tsx` to replace the current Savings & Goals placeholder with this feature, passing the authenticated `userId` and `deviceId`; keep the established MobileShell visual language and screen-level loading/error feedback.
- The list shows goal name, category, target, starting/current amount, priority, target date when present, and a clear empty-state CTA. The detail screen supports read and edit; delete opens the required explicit confirmation containing the documented deletion message, and disables only the selected goal action while the mutation is pending.
- The create flow exposes the prefilled Emergency Fund option with the saved six-month baseline explanation plus a Custom goal option. It uses the requirement placeholders and displays field-level validation errors and the specified generic savings save/load messages.

### 5. Verify Data, Sync, And User Behavior

- Add repository tests at `apps/app/local-db/repositories/__tests__/savingsGoals.test.ts` for user isolation, input validation, create/read/update/delete tombstones, queue payloads, no-op updates, and Emergency Fund baseline calculation across six completed months including missing months, deleted transactions, non-expense transactions, and centavo rounding.
- Extend `apps/app/local-db/sync/__tests__/queueOrder.test.ts` to prove rapid same-goal create -> update -> delete queue rows use insertion order when timestamps match, and add a sync integration test covering a failed create retry followed by its queued update. Add API service tests at `apps/api/src/__tests__/services/syncApplyOperation.savingsGoals.test.ts` for payload allowlists, invalid values, user-scoped update validation, and expected base-version progression of create (`null`), update (`1`), then delete (`2`). Extend `apps/app/local-db/sync/__tests__/pullConvergence.test.ts` and API sync-service coverage to cover another device pulling savings goals and remote tombstones.
- Add UI tests under `apps/app/features/savings-goals/__tests__/` for empty state, default Emergency Fund prefill, creation, detail read, edit persistence, validation feedback, and the two-step delete confirmation. Add a Maestro flow under `apps/app/maestro/` that creates the default goal, edits it, reopens it, and confirms deletion against an installed build.
- Run `pnpm --filter app test`, `pnpm --filter api test`, and the focused Maestro flow. Run the Supabase migration commands from Phase 3 but leave the migration undeployed unless explicitly approved.

## Acceptance Criteria

- A signed-in user can create a Custom savings goal with a valid name, positive target amount, non-negative starting amount, priority, and optional target date.
- A signed-in user can open the Savings & Goals page, read a goal's details, edit it, and see the saved result after reopening the screen.
- A signed-in user can choose a default Emergency Fund form whose target equals the total of posted expenses in the six previous completed calendar months divided by six, including zero-spend months.
- Saving the Emergency Fund goal records the baseline and target at that moment; later expense data does not change the target automatically.
- Every local and remote read or mutation is scoped by authenticated `user_id`; a goal ID from another user cannot be read, updated, or deleted.
- Deleting a goal requires explicit confirmation, removes it from active views, preserves a sync tombstone, and queues a user-scoped delete operation.
- Rapid offline mutations of one goal synchronize in insertion order: create first, then update, then delete. A retrying create remains ahead of its later update, and all three operations are tested against the same timestamp case.
- The local goal record, queued payload, queue ordering, API validator, API pull table list, remote private RPC handler, and local pull-table list all support `savings_goals` before the feature is considered complete.
- The slice contains no account linking, contributions, withdrawals, transaction integration, allocation, or interest behavior.

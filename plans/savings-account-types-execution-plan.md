# Savings Account Types Execution Plan

## Goal

Add typed non-goal savings accounts to the existing offline-first financial-account flow: Personal Savings (the product requirement's Regular Savings), High-Yield Savings Account (HYSA), and Time Deposit. Goal Savings remains the existing `savings_goals` holding-record model, with Emergency Fund remaining a Goal Savings category rather than an account type; the first slice deliberately does not introduce an undefined catch-all "other" type.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/feature-modules.md`, sections 8.1-8.10 and 8.16-8.17.
- Existing Goal Savings contract: `apps/app/features/savings-goals/types.ts`, `apps/app/local-db/repositories/savingsGoals.ts`, and `apps/app/local-db/repositories/savingsGoalActivities.ts`.
- Existing financial-account and sync contract: `apps/app/local-db/repositories/financialFoundations.ts`, `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, and `apps/app/local-db/sync/pullConvergence.ts`.
- Existing account UI: `apps/app/features/financial-accounts/FinancialAccountsScreen.tsx`.

## Non-Goals

- Do not rename or repurpose `SavingsGoalCategory`; its current and future values describe a Goal Savings purpose, not where money is held.
- Do not add a vague `other` savings-account type without required fields and behavior; add a new closed type only with a follow-up requirements change.
- Do not move Goal Savings records into `financial_accounts`, link them to a financial account, or alter their contribution/withdrawal transaction contract.
- Do not implement automatic interest crediting, Savings Envelope allocation, projections, recurring-transaction execution, alerts, or early-withdrawal penalty calculation.
- Do not deploy Supabase migrations without explicit user approval.

## Execution Order

## PR Stacking Strategy

Ship the typed account data and sync contract before exposing type-specific forms. Keep Goal Savings unchanged in this stack so its virtual holding-account transaction boundary remains stable.

```text
main
└─ feat/savings-account-types-foundation
   ├─ feat/savings-account-types-sync
   └─ feat/savings-account-types-ui
```

```bash
git switch -c feat/savings-account-types-foundation
```

Merge the foundation first, then sync, then UI. The sync PR must contain every allowlist, RPC branch, and pull-table change for `savings_account_details`; no UI may queue the entity before that contract is complete.

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready: typed savings-account persistence and sync; account form and overview; verification.

### 1. Define The Savings Account Taxonomy And Type-Specific Contract

- Update `apps/app/local-db/repositories/financialFoundations.ts` and add focused savings-account types under `apps/app/features/savings-accounts/` or `apps/app/features/financial-accounts/`: `personal_savings`, `high_yield_savings`, and `time_deposit`; display Personal Savings as the requirement's Regular Savings and HYSA as High-Yield Savings Account.
- Keep `financial_accounts.kind = "savings"` as the broad ledger-compatible account kind, and model the closed subtype separately. `SavingsGoalCategory` continues to contain only goal purposes such as `emergency_fund` and `custom`; do not make HYSA or Personal Savings selectable goal categories.
- Define an exhaustive account-type configuration for labels, placeholders, required inputs, and validation: Personal Savings requires non-negative interest rate and minimum balance; HYSA requires non-negative base/effective rates and non-empty bounded conditions; Time Deposit requires positive principal, non-negative rate, valid start/maturity dates with maturity after start, term, and a bounded early-withdrawal rule.

### 2. Persist Savings Account Details Locally And Preserve Existing Accounts

- Add `apps/app/local-db/migrations/054_savings_account_details.ts`, register it in `apps/app/local-db/client.ts`, and create a user-owned `savings_account_details` table keyed by `account_id`. Store the savings subtype and explicit nullable type-specific fields rather than unvalidated JSON, with version, tombstone, timestamps, and a user-scoped active index.
- Backfill every live existing `financial_accounts.kind = "savings"` record as `personal_savings`, retaining balances and transaction history; leave non-savings accounts without a details row. The repository must read the parent financial account and its details in one bounded query path, never by a bare account ID.
- Extend `apps/app/local-db/repositories/financialFoundations.ts` or extract a focused `savingsAccounts.ts` repository for validated create, read, update, archive, and soft-delete operations. Each mutation validates the parent is a user-owned active savings account and commits its row plus its sync queue operation inside one SQLite transaction.

### 3. Complete The Offline Sync And Remote Ownership Contract

- Add `savings_account_details` to `apps/app/local-db/types.ts` `SyncableEntity`, local queue dependency ordering if required, `apps/app/local-db/sync/pullConvergence.ts` `SYNCED_TABLES`, identity columns, and `LOCAL_COLUMNS`. Pull convergence must preserve the child record only for its current user's owned financial account and correctly apply detail tombstones.
- Update `apps/api/src/services/syncApplyOperation.ts` with narrow create/update allowlists and subtype-specific validation. The API must verify that `account_id` identifies the current user's `financial_accounts` record whose `kind` is `savings`, reject cross-user IDs and type-incompatible fields, and reject client-supplied server columns.
- Add a forward `supabase/migrations/<timestamp>_add_savings_account_details.sql` migration to create the remote detail table, ownership and subtype check constraints, indexes, RLS, and the private/public sync RPC handler branch. Add the table to `apps/api/src/services/syncService.ts` with a user-scoped pull query; run `supabase migration list --linked` and `supabase db push --dry-run`, but do not deploy.

### 4. Collect And Present Type-Specific Savings Account Details

- Refactor `apps/app/features/financial-accounts/FinancialAccountsScreen.tsx` into focused account-form and savings-detail components as needed, keeping the existing financial-account screen as orchestration. Choosing the broad Savings kind reveals the required subtype selector; changing subtype clears only fields inapplicable to the newly selected subtype after explicit user confirmation when saved data would be discarded.
- Render Personal Savings, HYSA, and Time Deposit details with the exact requirement placeholders and inline validation messages. The account list and detail view show the subtype, balance, and appropriate rate or maturity summary without duplicating account-balance calculations from the ledger.
- Extend `apps/app/features/savings-goals/SavingsGoalsScreen.tsx` or introduce a thin Savings overview screen in `apps/app/components/MobileShell.tsx` so it presents Goal Savings alongside typed financial savings accounts. Goal creation/activity controls stay available only for Goal Savings; ordinary ledger transfers remain the contribution and withdrawal mechanism for non-goal savings accounts.

### 5. Guard Time Deposit Withdrawals And Account Lifecycle Actions

- Extend `apps/app/features/ledger/NewTransactionScreen.tsx` and its account-selection helpers so a transfer out of an active Time Deposit before its maturity date presents the requirements' explicit early-withdrawal confirmation before the transfer is saved. This is a client safety guard, not a substitute for sync validation.
- Enforce the same user-owned Time Deposit lookup in `apps/api/src/services/syncApplyOperation.ts` and the remote RPC before applying an early withdrawal. The backend validates account ownership and maturity state; explicit user confirmation remains a UI requirement because a sync payload cannot prove that a person read a confirmation prompt.
- Keep archive and delete actions explicitly confirmed and item-scoped. Archiving removes a savings account from active selectors while retaining historical transactions; deleting creates a tombstone and must not hard-delete referenced transaction history.

### 6. Verify Type Rules, Sync Convergence, And User Flows

- Add repository tests for legacy savings-account backfill, all subtype validations, user isolation, no-op updates, archive/delete tombstones, and transactionally queued detail operations. Add model tests for the exhaustive subtype configuration and date/maturity validation.
- Extend `apps/api/src/__tests__/services/syncApplyOperation.savingsGoals.test.ts` or add `syncApplyOperation.savingsAccountDetails.test.ts` for payload allowlists, subtype-specific rejections, ownership checks, tombstones, and Time Deposit early-withdrawal confirmation. Extend app/API pull-convergence coverage for details created, updated, deleted, and pulled to a second device.
- Add React Native tests for subtype switching, field-level validation, existing-record edits, active-only selector behavior, and destructive confirmations. Update `apps/app/maestro/savings-goals-crud.yaml` only for unchanged goal coverage and add `apps/app/maestro/savings-account-types.yaml` after inspecting installed-app selectors; run `pnpm --filter app test -- --runInBand`, `pnpm --filter app exec tsc --noEmit`, `pnpm --filter api test`, and `pnpm test`.

## Acceptance Criteria

- A user can create, view, edit, archive, and delete a Personal Savings, HYSA, or Time Deposit financial account, and each record is owned and queried by `user_id`.
- Personal Savings uses non-negative interest-rate and minimum-balance inputs; HYSA uses base/effective rates plus conditions; Time Deposit uses principal, interest rate, start date, maturity date, term, and an early-withdrawal rule.
- Existing generic Savings financial accounts migrate to Personal Savings details without losing their balance, history, or sync identity.
- Goal Savings remains a separate holding-record model, and Emergency Fund remains a goal category rather than a Personal Savings or HYSA subtype.
- The Savings overview distinguishes Regular/Personal Savings, HYSA, Goal Savings, and Time Deposit, while goal progress and activity actions remain limited to Goal Savings.
- An early Time Deposit withdrawal requires explicit confirmation locally, and the remote path validates that the account and transfer both belong to the authenticated user.
- The local entity type, queue payload, API validator, remote RPC, API pull list, and local pull convergence all support `savings_account_details` before the UI is considered complete.
- Focused repository, app, API, TypeScript, Maestro, and Supabase dry-run checks pass; no remote migration is deployed without approval.

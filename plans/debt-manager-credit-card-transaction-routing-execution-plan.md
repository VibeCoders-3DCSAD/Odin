# Debt Manager Credit Card Transaction Routing Execution Plan

## Goal

When a user creates an expense and selects a credit-card financial account as the source, save the expense and its credit-card billing-cycle relationship in one local transaction, then show the transaction under that card's current active billing cycle in Debt Manager. Use the posting date when available and the transaction date as the fallback estimate, while preserving the existing local-first and sync architecture.

## Source Of Truth

- Product source of truth: `docs/requirements-engineering/feature-modules.md`, sections 7.4, 7.5, 7.11, and 7.8.6.
- Existing transaction entry: `apps/app/features/ledger/NewTransactionScreen.tsx`.
- Existing transaction persistence: `apps/app/local-db/repositories/ledger.ts`.
- Existing cycle persistence and date rules: `apps/app/local-db/repositories/creditCardCycles.ts` and `apps/app/local-db/repositories/creditCardCycleDates.ts`.
- Existing Debt Manager display: `apps/app/features/debt-manager/DebtManagerScreen.tsx`.

## Non-Goals

- No credit-card statement, payment, installment, early-settlement, or repayment-strategy workflow.
- No non-credit-card debt implementation.
- No issuer synchronization or bank integration; posting date remains user-entered data when supported and otherwise uses the transaction date as an estimate.
- No automatic statement balance, minimum due, finance-charge, or payment-requirement calculation.
- No redesign of the general transaction form beyond the fields and routing needed for credit-card purchases.

## Execution Order

## PR Stacking Strategy

Work directly on the current branch. Keep this as one vertical slice unless the sync changes become independently reviewable.

```text
current branch
├─ transaction-to-cycle domain seam
├─ atomic local persistence and sync
├─ Debt Manager transaction display
├─ transaction form wiring
└─ focused verification
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready; keep them grouped under the parent Debt Manager feature if one exists.

### 1. Define The Transaction Routing Seam

- Touch `apps/app/local-db/repositories/creditCardCycles.ts`, `apps/app/local-db/repositories/creditCardCycleDates.ts`, and add a focused helper/repository under `apps/app/local-db/repositories/` for resolving a transaction to a cycle.
- Resolve the target credit-card account with an explicit `user_id` ownership check, prefer `credit_card_posting_date`, and fall back to `transaction_date` when posting date is unavailable; never silently route a non-credit-card account.
- Resolve the active cycle by the effective date and card cutoff snapshot, materializing the current cycle only when required. Preserve existing historical cycles and reject dates that do not belong to the selected cycle rather than attaching the transaction incorrectly.
- Keep date arithmetic outside JSX and use the existing ISO-date validation and short-month clamping rules.

### 2. Persist The Expense And Credit-Card Relationship Atomically

- Touch `apps/app/local-db/repositories/ledger.ts`, `apps/app/local-db/types.ts`, and the relevant local sync helpers; add or extend a focused `creditCardTransactions.ts` repository only if that keeps the ledger orchestrator small.
- Extend the expense creation transaction so a credit-card expense inserts the base `transactions` row and the `credit_card_transactions` row with `purchase_type: regular` and the resolved `cycle_id` before enqueueing both sync operations.
- Keep balance effects and available-credit effects consistent with the existing SQLite triggers; a failed cycle resolution or relationship insert must roll back the expense rather than leave an unlinked credit-card transaction.
- Use the transaction/client mutation identity to make retries idempotent. Add ownership checks for the account, cycle, and transaction relationship, and prevent duplicate relationships.
- Decide and document the edit/delete boundary in code: if card source or effective date changes, update the relationship in the same transaction; if a supported edit cannot be routed safely, reject it with the requirements-aligned unavailable message rather than leaving stale cycle membership.

### 3. Complete Sync Support For The Relationship

- Touch `apps/app/local-db/types.ts`, `apps/app/local-db/sync/pullConvergence.ts`, `apps/api/src/services/syncApplyOperation.ts`, and `apps/api/src/services/syncService.ts`; add a migration only if the existing local sync columns or indexes are insufficient.
- Add `credit_card_transactions` to the client and API sync allowlists, validate its allowed fields, and route it to the appropriate Supabase operation without allowing arbitrary table or column input.
- Ensure pull identity, user scoping, conflict handling, and soft-delete behavior match the existing credit-card cycle sync. The server must verify that the referenced transaction, account, and cycle all belong to the authenticated user.
- Keep relationship sync separate from the base transaction payload while preserving local atomicity; retries must not create a second relationship or double-apply available-credit changes.

### 4. Render Transactions In The Active Billing Cycle

- Touch `apps/app/local-db/repositories/creditCardCycles.ts` or add a focused cycle-transaction query module, plus `apps/app/features/debt-manager/DebtManagerScreen.tsx`.
- Query active, user-owned credit-card transactions joined to their cycle and base transaction, grouped by account and cycle, with the current cycle explicitly identified by the cycle date range rather than array position alone.
- Display each current-cycle transaction with merchant/description, amount, transaction date, and purchase type. Keep prior cycles available for history without mixing their transactions into the current-cycle list.
- Add the applicable Section 7 states/messages for loading, empty current-cycle activity, stale data, and safe load failure. Do not display an estimated statement date or imply that a transaction is a statement payment.

### 5. Wire New Transaction Entry And Verify The Slice

- Touch `apps/app/features/ledger/NewTransactionScreen.tsx` and its existing transaction test location. When the selected source account is an active credit card, route creation through the credit-card-aware expense path; preserve ordinary expense behavior for all other accounts.
- Add the optional posting-date input only if the existing transaction UX supports exposing it in this slice; otherwise use the transaction date as the explicit fallback and leave the data model ready for posting-date entry.
- Keep the form's purchase-type boundary explicit. This slice records a regular purchase; installment creation remains deferred and must not be represented as a fake regular purchase.
- Add focused tests for selecting a credit card, successful atomic routing, current-cycle display, transaction-date fallback, posting-date routing when available, missing/invalid cycle handling, duplicate retry safety, and ordinary-account regression behavior.
- Verify with `pnpm --dir apps/app test -- --runInBand`, the relevant API tests, and the app TypeScript check/build command used by the repository. Add a Maestro flow only when an installed APK/emulator path is available.

## Acceptance Criteria

- Selecting an active credit-card account as the source of a new expense creates a regular credit-card purchase relationship.
- The expense and `credit_card_transactions` relationship are committed atomically and are both user-scoped.
- The relationship points to the correct active billing cycle using posting date first and transaction date as fallback.
- The transaction appears immediately under the matching card's current billing cycle in Debt Manager after returning or refreshing the screen.
- The current-cycle view shows transaction description, amount, date, and purchase type without presenting it as a statement or payment.
- Ordinary cash, bank, savings, and other account expenses continue to use the existing path unchanged.
- Failed routing cannot leave an ordinary unlinked credit-card expense in the ledger.
- Repeated sync/retry processing does not duplicate the relationship or double-debit available credit.
- Historical cycles remain unchanged when a new transaction is recorded.
- Focused app and API tests pass, including transaction, cycle-routing, Debt Manager, and sync coverage.

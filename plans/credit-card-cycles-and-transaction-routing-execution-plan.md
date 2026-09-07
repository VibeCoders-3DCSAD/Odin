# Credit Card Cycles And Transaction Routing Execution Plan

## Goal

Complete the next Credit Card vertical slice: let users create and override billing-cycle snapshots, identify the active cycle by its date range, and record Credit Card purchases from the transaction form using posting date when available and transaction date as the fallback. Regular and installment purchases must be represented explicitly and saved atomically with their billing-cycle relationship, without pretending that issuer reconciliation or statement data exists yet.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/feature-modules.md`, sections 7.2, 7.3, 7.4, 7.5, 7.8.4, 7.8.5, and 7.11.
- Existing cycle repository and date rules: `apps/app/local-db/repositories/creditCardCycles.ts` and `apps/app/local-db/repositories/creditCardCycleDates.ts`.
- Existing account model: `apps/app/local-db/repositories/financialFoundations.ts`.
- Existing transaction persistence: `apps/app/local-db/repositories/ledger.ts`.
- Existing transaction UI: `apps/app/features/ledger/NewTransactionScreen.tsx`.
- Existing Credit Card display: `apps/app/features/debt-manager/DebtManagerScreen.tsx`.
- Existing local schema: `apps/app/local-db/migrations/024_credit_cards.ts` and subsequent Credit Card migrations.

## Non-Goals

- No bank integration or automatic issuer reconciliation.
- No statement recording, authoritative statement balances, minimum payments, finance charges, or due-date workflows.
- No stale issuer-data calculation; the existing stale message should only be used for actual load/sync failures, not normal local estimates.
- No threshold-based available-credit alerts in this slice; those depend on issuer-reconciled values and statement support.
- No Credit Card payment, credit-balance application, or early-settlement workflow.
- No Snowball/Avalanche or debt-budget integration.
- Do not silently save a Credit Card expense as an ordinary unlinked transaction.

## Execution Order

## PR Stacking Strategy

Keep the work as one vertical slice if implemented on the current branch. If separate review is preferred, stack the domain/persistence seam first, then UI wiring, then installment support and verification.

```text
current branch
├─ cycle resolution and manual cycle controls
├─ atomic transaction-to-cycle persistence
├─ transaction form posting date and purchase type
├─ installment record creation
└─ Debt Manager display and verification
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready; keep them grouped under the parent Credit Card or Debt Manager feature.

### 1. Make Billing-Cycle Resolution Explicit

- Touch `apps/app/local-db/repositories/creditCardCycles.ts`, `apps/app/local-db/repositories/creditCardCycleDates.ts`, and add a focused resolver such as `apps/app/local-db/repositories/creditCardCycleRouting.ts`.
- Resolve only an active, user-owned Credit Card account; use the billing-cycle snapshot's dates for historical cycles and the card defaults only when materializing a missing current cycle.
- Select the current cycle by `cycle_start_date <= effectiveDate <= cutoff_date`, not by array position. Prefer `credit_card_posting_date`; fall back to `transaction_date` and expose whether the fallback was used.
- Add repository-level update/override support for cycle dates while preserving existing historical rows. Validate ISO dates, `start <= cutoff`, and the requirements-aligned statement-date rule when a statement date is eventually supplied.
- Keep short-month clamping and month rollover in the date helper, with tests for February, day 31, cutoff boundaries, and year boundaries.

### 2. Add Billing-Cycle Creation And Override UI

- Touch `apps/app/features/debt-manager/DebtManagerScreen.tsx` and add a small colocated cycle form component if needed; reuse existing date-picker and form conventions rather than adding a dependency.
- Add explicit actions for a card with no cycle and for overriding the current cycle's start/cutoff dates. The form must use `Select billing-cycle start date` and `Select cut-off date` placeholders and preserve valid values after validation failure.
- Show the exact applicable messages from section 7.8.5: loading, empty billing cycle, credit-card saving, credit-card saved, and credit-card recovery/error. Do not use statement-success copy for cycle creation.
- Refresh the card's cycle list after create/update and keep prior cycles visible as historical records.

### 3. Persist Regular Purchases And Cycle Relationships Atomically

- Touch `apps/app/local-db/repositories/ledger.ts`, `apps/app/local-db/types.ts`, and add `apps/app/local-db/repositories/creditCardTransactions.ts` only if it keeps transaction orchestration focused.
- Extend transaction inputs and persistence to carry `credit_card_posting_date` when provided. Resolve the cycle before committing, insert the base transaction and Credit Card relationship in one SQLite transaction, and enqueue both operations together.
- Keep regular purchases as `purchase_type: regular`; a failed resolver, invalid date, missing cycle, ownership failure, or relationship insert must roll back the base transaction and any balance effects.
- Preserve retry safety with `client_mutation_id`, user-scoped account/cycle/transaction checks, and unique relationship identity. Update or reject edits that would make the recorded purchase belong to a different cycle; never leave stale membership.

### 4. Add Credit Card Fields To Transaction Entry

- Touch `apps/app/features/ledger/NewTransactionScreen.tsx` and its existing test location.
- When the selected expense source is an active Credit Card, show the Credit Card purchase controls: posting date, purchase type, and the requirements-aligned Credit Card selector labels/placeholders. Keep ordinary account expenses unchanged.
- Route regular purchases through the Credit Card-aware persistence path. Use the transaction date explicitly as the estimate when posting date is empty, and make that fallback visible in the resulting cycle detail without calling it a bank-confirmed posting date.
- For invalid or unavailable routing, show the exact `Credit-card transactions cannot be recorded until billing-cycle routing is available.` message or the applicable Credit Card validation/recovery message; do not show a generic successful-save toast.

### 5. Implement Explicit Installment Purchase Recording

- Touch `apps/app/local-db/repositories/creditCardInstallments.ts`, `apps/app/local-db/repositories/ledger.ts`, `apps/app/local-db/types.ts`, and the Credit Card transaction form component.
- Add the section 7.5.4 installment fields, placeholders, and validation: original/remaining principal, term/remaining months, monthly amortization, interest rate/type, and settlement status. Link the installment to the originating Credit Card transaction and cycle.
- Insert the installment and Credit Card transaction relationship atomically. Record only the applicable amortization in the cycle while preserving the full purchase amount for available-credit effects handled by the existing database rules.
- Do not create an Obligation Module record. Keep settlement status active until a later issuer-recognition workflow explicitly changes it.

### 6. Render Correct Active-Cycle Transactions And Verify

- Touch `apps/app/local-db/repositories/creditCardCycles.ts`, `apps/app/features/debt-manager/DebtManagerScreen.tsx`, and focused tests under `apps/app/features/debt-manager/__tests__/` and `apps/app/local-db/repositories/__tests__/`.
- Query transactions by the explicitly resolved active cycle and account, displaying merchant, amount, transaction date, posting date when present, purchase type, and installment context without presenting estimates as statements.
- Add coverage for manual cycle creation/override, current-cycle selection, cutoff boundaries, posting-date routing, transaction-date fallback, regular and installment purchase creation, rollback on routing failure, duplicate retries, and ordinary-account regression behavior.
- Run `pnpm --filter app test -- --runInBand` and the app TypeScript/build check used by the repository. Run relevant API sync tests after adding any new sync entities.

## Acceptance Criteria

- A user can create a billing cycle for a Credit Card with start and cutoff dates.
- A user can override a current cycle without modifying historical cycle snapshots.
- Debt Manager identifies the current cycle by date range rather than `cycles[0]`.
- A Credit Card expense uses posting date when supplied and transaction date as an explicit fallback when it is not.
- Regular and installment purchase types are explicitly represented in the transaction flow.
- Credit Card transactions cannot be saved without a valid user-owned billing cycle.
- Base transactions, Credit Card relationships, installment records, balance effects, and sync operations remain atomic and retry-safe.
- Current-cycle transactions display under the correct card and cycle with their purchase type.
- Ordinary cash, bank, savings, and other-account transaction behavior remains unchanged.
- Statement recording, issuer reconciliation, stale issuer-data handling, and threshold alerts remain intentionally deferred.
- Focused app and API tests pass.

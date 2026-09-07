# Credit-Card Installment Transaction Execution Plan

## Goal

Extend the existing new-expense flow so a user who selects a credit-card account can choose an installment purchase, enter the required installment terms, and atomically save the ledger expense, billing-cycle relationship, and long-term installment record. The purchase must debit available credit by the full original principal locally, while only its monthly amortization represents the applicable billing-cycle amount, subject to later issuer reconciliation.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/feature-modules.md`, sections 7.2, 7.4–7.5.6, 7.7, 7.8.4–7.8.6, and 7.11.
- Existing transaction form: `apps/app/features/ledger/NewTransactionScreen.tsx`.
- Existing ledger and cycle persistence: `apps/app/local-db/repositories/ledger.ts` and `apps/app/local-db/repositories/creditCardCycles.ts`.
- Existing local schema and sync seams: `apps/app/local-db/migrations/024_credit_cards.ts`, `apps/app/local-db/sync/queueOrder.ts`, and `apps/app/local-db/sync/pullConvergence.ts`.
- Existing server-side credit-card invariant path: `supabase/migrations/20260921000000_sync_editable_credit_card_statements.sql` and the earlier credit-card sync migrations it delegates to.

## Non-Goals

- No bank/issuer integration or automated issuer reconciliation; available credit remains an Odin estimate until issuer data is recorded or synced.
- No credit-card payment, credit-balance application, early-settlement, statement repayment-strategy, or non-credit-card debt workflow.
- No recurring-installment generation: an installment purchase is a one-time credit-card transaction with a long-term installment record.
- No editing or deleting an installment transaction in this slice unless the relationship and available-credit effects can be safely reversed together; define an explicit unavailable/immutable boundary instead of corrupting the installment history.

## Execution Order

## PR Stacking Strategy

Keep the work as one vertical slice on a feature branch, splitting only if the migration/sync contract needs separate review.

```text
current branch
├─ installment domain repository and local schema guards
├─ atomic ledger + credit-card persistence and sync ordering
├─ installment form controls and transaction-flow wiring
├─ Debt Manager installment visibility
└─ focused client and API verification
```

```bash
# Optional stacked split if needed:
git switch -c feat/credit-card-installment-domain
# merge domain + sync prerequisites first
git switch -c feat/credit-card-installment-transaction-ui
# base this branch on the merged prerequisite
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Define the installment domain seam and local invariants

- Touch `apps/app/local-db/repositories/creditCardInstallments.ts` (new), `apps/app/local-db/migrations/` (next migration only if the current SQLite schema lacks required checks/indexes), `apps/app/local-db/client.ts`, and `apps/app/local-db/sync/pullConvergence.ts`.
- Add user-scoped types, reads, and validation for `original_principal_centavos`, `remaining_principal_centavos`, `term_months`, `remaining_months`, `monthly_amortization_centavos`, interest type/rate, settlement status, account, and linked transaction; require positive/non-negative values exactly as section 7.5.6 specifies and reject values whose remaining figures exceed their originals.
- Keep amortization calculation and centavo rounding in this focused repository, not `NewTransactionScreen.tsx`; decide one deterministic formula shared by local validation and the server contract, including the final-payment rounding remainder.
- Add a pure cycle-amortization projection helper that uses the linked purchase cycle as month one and subsequent materialized card cycles for remaining months. It must return only one due amount per cycle (monthly amortization, or the bounded final remainder), rather than treating the original purchase amount as a charge in every cycle.
- Add `credit_card_installments` to pull convergence with its UUID identity, allowed local columns, and user-scoped upsert behavior so another device receives the relationship rather than only a transaction marked `installment`.

### 2. Make installment purchase persistence atomic and sync-safe

- Touch `apps/app/local-db/repositories/ledger.ts`, the new `apps/app/local-db/repositories/creditCardInstallments.ts`, `apps/app/local-db/sync/queueOrder.ts`, `apps/app/local-db/sync/runSync.ts`, `apps/app/local-db/types.ts`, and `apps/api/src/services/syncApplyOperation.ts` plus focused API tests.
- Extend the credit-card expense path with a typed installment input: resolve the card cycle from posting date first (transaction date fallback), insert the base expense, insert the installment linked to that transaction, insert `credit_card_transactions` with `purchase_type: "installment"` and the installment ID, debit available credit by the original principal, and enqueue all three operations inside one SQLite transaction.
- Preserve the existing full-purchase available-credit convention: use the original principal, never merely the monthly amortization; use the same principal for over-limit warning/confirmation, create/update/delete reversal, and server reconciliation.
- Queue dependencies deterministically as base `transactions` create → `credit_card_installments` create → `credit_card_transactions` create, while retaining the current delete-before-transaction behavior; ensure retries use stable client mutation/record IDs and cannot double-debit available credit.

### 3. Align server synchronization and authorization with the local slice

- Touch the next ordered `supabase/migrations/<timestamp>_*.sql`, `apps/api/src/routes/sync.ts` only if an entity allowlist is incomplete, and `apps/api/src/__tests__/services/syncApplyOperation.creditCardTransactions.test.ts` plus new installment-focused tests.
- Verify and, if needed, extend the RPC invariant path so it accepts a user-owned `credit_card_installments` create before the linked `credit_card_transactions` create; enforce transaction/card/cycle/installment ownership, immutable relationship keys, allowed field whitelist, and idempotent applied-operation handling.
- Confirm the server debits available credit once by original principal for installment purchases, never independently trusts a client-supplied available-credit value, and preserves issuer reconciliation as the authority for later restoration.
- Add a regression test for offline queue replay and another for cross-user or cross-card IDs being rejected with no partial remote writes.

### 4. Add installment controls to the new transaction form

- Touch `apps/app/features/ledger/NewTransactionScreen.tsx` and extract `apps/app/features/ledger/components/CreditCardInstallmentFields.tsx` plus a small colocated parser/validator helper if that keeps the screen focused.
- When the expense source is a credit card, expose the required `Regular Purchase / Installment Purchase` selector; for installment selection, collect merchant/description, original principal (the transaction amount), term, interest type, interest rate only when interest-bearing, and settlement status, while derive-or-display the remaining principal/months and monthly amortization according to the domain helper.
- Validate dates, source account, category, purchase type, and all installment fields before showing the existing over-limit confirmation; label the available-credit impact plainly as the full purchase principal and show the issuer-reconciliation notice where the estimate is presented.
- Keep the existing regular-credit-card and non-card expense paths unchanged. Disable the generic recurring toggle for installment purchases in this slice because recurring templates would create independent purchases, not an amortization schedule.

### 5. Present the recorded installment without misrepresenting a statement charge

- Touch `apps/app/local-db/repositories/creditCardCycles.ts` or the new installment repository, `apps/app/features/debt-manager/CreditCardCollections.tsx`, and the parent Debt Manager screen/hook that loads its data.
- Join each user-owned installment to its base credit-card transaction and show description, original and remaining principal, term/remaining months, monthly amortization, interest type/rate, and settlement status; retain the billing-cycle list’s `Installment purchase` label.
- Use the cycle-amortization projection for the purchase cycle and every later applicable cycle, showing only one monthly amortization (or final remainder) as that cycle’s installment due/estimated contribution—not the entire original principal or a duplicated amount in every cycle. Keep card available credit separately displayed as reduced by the issuer-recognized full hold.
- Implement the applicable requirements states and exact messages: transaction-recording, installment-creation, installment-active, installment-saved, stale issuer data, and safe error recovery; do not claim an installment is completed unless an issuer-recognized settlement exists.

### 6. Lock the mutation boundary down and verify behavior

- Touch `apps/app/local-db/repositories/ledger.ts`, `apps/app/local-db/repositories/__tests__/ledger.test.ts`, new `apps/app/local-db/repositories/__tests__/creditCardInstallments.test.ts`, `apps/app/features/ledger/__tests__/NewTransactionScreen.test.tsx`, and the API sync test directory.
- For this first slice, reject editing purchase type or installment terms after creation and reject deletion of a linked installment purchase unless a later dedicated cancellation/reversal flow is implemented; the UI must surface a requirements-aligned recovery error rather than apply only half of the relationship change.
- Test zero-interest and interest-bearing validation, date-to-cycle routing, full-principal available-credit debit, monthly-amortization cycle display, local rollback on any failed insert, regular-purchase regression, non-card regression, sync order/idempotency, ownership checks, and pull convergence.
- Verify with `pnpm --filter app test -- --runInBand`, `pnpm --filter api test`, and `pnpm test`; run the project’s app typecheck/build command if it exists, and add a Maestro flow only when an installed APK/emulator path is available.

## Acceptance Criteria

- A user selecting a credit-card expense source can explicitly choose Regular Purchase or Installment Purchase.
- An installment requires all fields mandated by section 7.5.6 and persists one base transaction, one credit-card transaction relationship, and one long-term installment record atomically.
- The base transaction routes to the correct user-owned billing cycle using posting date first and transaction date only as the documented fallback estimate.
- Available credit is reduced by the full original principal, while the applicable cycle represents only the monthly amortization due.
- Available credit restoration is not assumed from the amortization schedule; issuer recognition and later payment workflows remain the authority.
- Regular credit-card purchases and all non-credit-card transaction flows remain unchanged.
- Invalid, cross-user, cross-card, duplicate, and partial sync attempts cannot create orphaned records or double-apply the available-credit effect.
- Debt Manager shows active installment details and does not mark an installment completed absent issuer-recognized settlement.
- Focused app, local repository, and API sync tests pass, followed by the root `pnpm test` command.

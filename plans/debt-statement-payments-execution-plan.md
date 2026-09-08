# Debt Statement Payments Execution Plan

## Goal

Add a local-first Credit Card statement-payment flow that starts with `Pay` in Debt Manager and routes to a prefilled Transaction form. Saving that expense atomically creates the matching payment against the authoritative statement, derives its payment status and finance-charge warning, and retains any amount above the statement balance as an unapplied credit balance without changing the card limit or installment lifecycle.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/feature-modules.md`, sections 7.2, 7.4, 7.6, 7.7 through 7.7.3, 7.8.4 through 7.8.6, and 12.1 through 12.17.
- Existing statement persistence: `apps/app/local-db/repositories/creditCardStatements.ts` and `apps/app/features/debt-manager/CreditCardStatementForm.tsx`.
- Existing payment tables and invariant path: `apps/app/local-db/migrations/024_credit_cards.ts`, `supabase/migrations/20260922000000_allow_installment_sync_order.sql`, and later Credit Card migrations.
- Existing sync boundaries: `apps/app/local-db/types.ts`, `apps/app/local-db/sync/pullConvergence.ts`, `apps/api/src/services/syncApplyOperation.ts`, and `apps/api/src/services/syncService.ts`.

## Non-Goals

- No repayment-strategy selector or debt-budget integration; that is section 7.8 and must remain independent from Snowball and Avalanche.
- No application of an accrued credit balance to a future charge, no issuer integration or automatic reconciliation, and no changes to the official credit limit.
- No installment early-settlement request or completion workflow; recording or recognizing a statement payment must not shorten, reduce, or settle an installment.
- No editable payment fields, source-account picker, or expense-category picker in Debt Manager; it only exposes the statement-level `Pay` action.

## Execution Order

## PR Stacking Strategy

Keep this as one vertical slice on a feature branch. Split only if the database/RPC invariant correction needs independent review before the app repository and UI work.

```text
main
└─ feat/credit-card-statement-payments
   ├─ payment domain, status calculation, and database guards
   ├─ atomic transaction and payment persistence
   ├─ payment sync and remote Credit Card RPC alignment
   ├─ Debt Manager payment form and statement history
   └─ cross-boundary tests and migration validation
```

```bash
git switch -c feat/credit-card-statement-payments
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Define The Statement-Payment Domain And Local Invariants

- Touch `apps/app/local-db/migrations/043_credit_card_statement_payments.ts` (new), `apps/app/local-db/client.ts`, `apps/app/local-db/repositories/creditCardPayments.ts` (new), and `apps/app/local-db/repositories/__tests__/creditCardPayments.test.ts` (new). Add a focused payment repository with user-scoped statement/payment reads, integer-centavo and ISO-date validation, and a pure status calculator: `fully_paid` when the active payment meets or exceeds the statement balance, `minimum_satisfied` when it meets the minimum but not the balance, and `partially_paid` otherwise.
- Require an authoritative, user-owned statement and its matching cycle for every payment; require a positive amount, payment date, user-owned source account, and matching linked expense transaction. Permit `amount_centavos > statement_balance_centavos`, and calculate `credit_balance_centavos = max(0, payment - statement_balance)` rather than mutating the statement or card limit. Add SQLite guards and a unique partial index for one live payment per user-owned cycle, plus valid payment-to-cycle/statement/source-account/transaction relationships, non-negative amounts, and one user-scoped `client_mutation_id`.
- Keep payment status derived from associated live payments rather than persisted on the statement, so a cross-device pull cannot leave stale status. Preserve the raw payment amount and an explicit `issuer_recognized` state for reconciliation, but do not mark issuer recognition or alter available credit as a side effect of local payment entry.

### 2. Persist A Transaction-Initiated Statement Payment Atomically

- Touch `apps/app/local-db/repositories/creditCardPayments.ts`, `apps/app/local-db/repositories/ledger.ts`, `apps/app/features/ledger/NewTransactionScreen.tsx`, and `apps/app/local-db/repositories/__tests__/ledger.test.ts`. Add a typed Credit Card statement-payment context to the new-expense route; its save boundary validates the selected statement/cycle, creates the ordinary expense transaction, then inserts the `credit_card_payments` row with its matching source account, amount, date, notes, transaction ID, and stable client mutation ID.
- Reuse the ledger's account/subcategory ownership and balance-effect rules. A statement-payment transaction always requires an eligible non-credit-card source account and expense category; any failed insert or queue enqueue rolls back both records and all local balance effects.
- Do not expose a payment-only creation path, route the payment expense through `credit_card_transactions`, debit the paid card, or create a non-credit-card `debt_payments` record. A Credit Card statement payment belongs solely to `credit_card_payments`, its statement/cycle, and its required ordinary expense transaction.

### 2.1 Support Payment Edits And Confirmed Deletion

- Touch `apps/app/local-db/repositories/creditCardPayments.ts`, `apps/app/local-db/repositories/ledger.ts`, and the next local migration only if it needs an explicit payment-to-transaction uniqueness guard. Allow edits only through the statement-payment repository: validate the same one-payment-per-cycle contract, update the linked transaction amount/date/source/category/notes and its account effects in the same SQLite transaction, then enqueue versioned updates in dependency order.
- Delete through an explicit confirmation action only. Atomically soft-delete the payment, soft-delete its required linked transaction and reverse its balance effect, enqueue both delete operations, and recalculate the statement as unpaid. Do not permit generic ledger edit/delete paths to mutate a linked Credit Card statement-payment transaction.

### 3. Complete The Payment Sync Contract And Correct Remote Effects

- Touch `apps/app/local-db/types.ts`, `apps/app/local-db/sync/queueOrder.ts`, `apps/app/local-db/sync/pullConvergence.ts`, `apps/api/src/routes/sync.ts`, `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, and focused API tests under `apps/api/src/__tests__/services/`. Register `credit_card_payments` as a sync entity and pull table with its UUID identity and local columns; route it through `apply_credit_card_sync_operation`, queue any linked `transactions` create before the payment create, and preserve idempotency with `client_mutation_id`.
- Add narrow create/update/delete API field allowlists for `cycle_id`, `statement_id`, required `transaction_id`, `amount_centavos`, `payment_date`, required `source_account_id`, optional bounded notes, `client_mutation_id`, and internally initialized `issuer_recognized: false`. Validate positive safe-integer amounts and dates, immutable statement/cycle relationship keys, optimistic versions, and authenticated-user ownership; confirm that the linked transaction's amount/source account match the payment exactly.
- Add the next forward `supabase/migrations/<timestamp>_credit_card_statement_payments.sql` migration. Harden the active Credit Card RPC, RLS/trigger relationship checks, and idempotent operation handling so they enforce the same ownership, cycle-to-statement, transaction-match, and positive-amount rules without trusting the API; include `credit_card_payments` in the current client/API allowlists and pull lists rather than relying on its dormant remote table.
- Replace the current issuer-recognition behavior that decrements all installments in a payment cycle. Recognition may update only the payment's recognition state and issuer-recognized available-credit estimate; it must never reduce `remaining_principal_centavos`, decrement `remaining_months`, or set an installment to `completed` unless a later explicit early-settlement operation is issuer-recognized.

### 4. Route Pay From Debt Manager To A Statement-Aware Transaction Form

- Touch `apps/app/components/MobileShell.tsx`, `apps/app/features/debt-manager/DebtManagerScreen.tsx`, `apps/app/features/debt-manager/CreditCardCollections.tsx`, and `apps/app/features/ledger/NewTransactionScreen.tsx`. Add a typed pending statement-payment context beside the shell's existing `transactionToEdit` and return-page state; `Pay` carries only opaque statement/cycle IDs to Transaction Management, whose screen resolves and validates them from local storage rather than trusting route parameters. Debt Manager must not render any editable payment inputs.
- The Transaction form is the sole payment-input surface. For a new payment it renders the selected statement context as immutable, then uses its existing amount, date, source-account, category, merchant/payer, and notes fields; for the existing payment, Debt Manager routes `Edit payment` to that same screen with the linked transaction and payment context. Show the Credit Card statement-payment notice from section 12.17, preserve valid input after validation failure, enforce one relationship per transaction, and use the existing native date-picker behavior.
- For each recorded statement, show its single active payment, remaining balance, and exactly one derived state message: Fully Paid, Minimum Satisfied, or Partially Paid. Show the specified finance-charge warning for every state that is not Fully Paid and the specified overpayment notice with the retained credit-balance amount when the payment exceeds the statement balance; do not imply it has been applied to a charge.
- Implement the required initial, empty-input, validation-failure, payment-recording, success, error, empty-source-account, edit, and deletion-confirmation states with the exact messages from sections 7.8.4 and 7.8.5. Preserve valid form input after failure, clear only corrected field errors, prevent duplicate submission for that statement, and require the new payment-deletion confirmation before deleting.

### 5. Verify Payment Semantics, Sync, And Regressions

- Add repository tests in `apps/app/local-db/repositories/__tests__/creditCardPayments.test.ts`, extend `apps/app/features/debt-manager/__tests__/DebtManagerScreen.test.tsx`, extend the Transaction screen tests, add `apps/api/src/__tests__/services/syncApplyOperation.creditCardPayments.test.ts`, and add the migration-level SQL assertions appropriate to the repository's Supabase test setup. Cover transaction-linked payment persistence, rollback on each partial failure, user ownership, mismatched statement/cycle, mismatched transaction source/amount, invalid dates/amounts, and stable idempotent retry behavior.
- Assert statuses for a payment below the minimum, exactly at the minimum, exactly at the statement balance, and over the balance; assert a duplicate live cycle payment is rejected, while a deleted payment permits a replacement. Assert edits and confirmed deletions atomically update or reverse the linked transaction and account balance, and assert an overpayment creates an unapplied credit balance while preserving the official limit and all installment remaining fields.
- Run `pnpm --filter app test -- --runInBand`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter app exec tsc --noEmit`, and `pnpm test`. Before deployment, run `supabase migration list --linked` and `supabase db push --dry-run`; do not deploy the migration without explicit user approval, and run a Maestro payment smoke flow only when an emulator or device is available.

## Acceptance Criteria

- A user can record exactly one active positive payment against each user-owned authoritative Credit Card statement and billing cycle.
- A payment contains amount, payment date, selected statement/cycle, required source account and linked expense transaction, optional notes, and uses the exact required placeholders and state messages.
- Selecting `Pay` in Debt Manager opens Transaction Management with a validated Credit Card statement context; saving the required expense transaction creates, links, syncs, or rolls back its statement payment atomically.
- Debt Manager contains no editable payment inputs; Transaction Management is the sole screen for entering and editing payment and expense details.
- The statement displays Fully Paid when its active payment meets or exceeds its balance, Minimum Satisfied when it meets its minimum but not its balance, and Partially Paid otherwise.
- Every non-fully-paid statement displays the finance-charge warning, and an overpayment remains an explicit unapplied credit balance without changing the official credit limit.
- Payment recording or issuer recognition does not modify installment principal, remaining months, or completion status.
- The single payment can be edited through its supported statement-payment flow; it can be deleted only after explicit confirmation, and linked transaction and balance effects update or reverse atomically.
- `credit_card_payments` is included end to end in the local sync type, queue ordering, API validation and RPC routing, remote ownership/invariant checks, API pull, and local pull convergence.
- Cross-user, cross-cycle, cross-statement, mismatched transaction, duplicate mutation, and invalid monetary/date requests fail without partial local or remote writes.
- Focused repository, UI, API, migration, TypeScript, build, and root test verification pass; remote migration deployment remains explicitly unperformed.

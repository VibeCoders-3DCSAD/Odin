# Credit-Card Reconciliation Forecast Anchor Plan

## Goal

Make an issuer available-credit reconciliation an authoritative, persisted
forecast anchor. Store both an issuer snapshot and the immediately preceding
transaction-derived available-credit estimate so the historical chart survives
restart. At the reconciliation as-of instant, card debt is `credit_limit_centavos
- reconciled_available_credit_centavos`; only card events occurring after that
instant change the forecast, while earlier ledger and statement data remains
intact as explanatory, estimated history.

## Source Of Truth

- User specification: issuer-reported available credit is authoritative at an
  explicit as-of point; never add pre-reconciliation purchases and payments to
  that anchor.
- Forecast calculator: `apps/app/features/debt-manager/creditCardForecast.ts`.
- Reconciliation UI and local mutation:
  `apps/app/features/debt-manager/CreditCardAvailableCreditReconciliation.tsx`
  and `apps/app/local-db/repositories/financialFoundations.ts`.
- Offline sync boundary: `apps/app/local-db/sync/runSync.ts`,
  `apps/api/src/services/syncApplyOperation.ts`, and
  `supabase/migrations/20261002000011_fix_credit_card_sync_payload_check.sql`.

## Non-Goals

- Do not alter, delete, redate, or synthesize historical transactions,
  statement balances, or statement payments.
- Do not claim sub-day precision for legacy card events that predate the new
  event-timestamp fields; render them as estimated history using their
  best-available migrated timestamp.
- Do not use reconciliation to change the configured credit limit or rewrite
  card repayment strategy rules.
- Do not retroactively recalculate existing reconciliations; cards with no
  recorded anchor retain the current transaction-derived history behavior.
- Do not deploy the Supabase migration without explicit approval.

## Execution Order

## PR Stacking Strategy

Keep this as one atomic reconciliation follow-up because the local schema,
sync contract, and forecast calculation must agree. Add it to the current
reconciliation work before opening one PR against `main`.

```text
main
└─ feat/credit-card-reconciliation-forecast-anchor
   ├─ database and sync: persist and synchronize the reconciliation as-of anchor
   ├─ frontend: anchor forecast math and label estimated history
   └─ tests: lock down no-double-counting and sync behavior
```

Create the branch with:

```bash
git switch -c feat/credit-card-reconciliation-forecast-anchor
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Persist And Synchronize The Reconciliation Anchor

- Touch `apps/app/local-db/migrations/051_credit_card_reconciliation_anchor.ts`,
  `apps/app/local-db/client.ts`,
  `apps/app/local-db/repositories/financialFoundations.ts`,
  `apps/app/local-db/repositories/creditCardCycles.ts`,
  `apps/app/local-db/repositories/creditCardPayments.ts`,
  `apps/app/local-db/sync/runSync.ts`, `apps/app/local-db/sync/pullConvergence.ts`,
  `apps/api/src/services/syncApplyOperation.ts`, and add one forward migration
  under `supabase/migrations/`.
- Add nullable `reconciled_available_credit_centavos`,
  `pre_reconciliation_available_credit_centavos`, and
  `available_credit_reconciled_at` to local and remote `credit_card_details`,
  expose them through the account row/type mapping and sync pull allowlist, and
  leave all three `NULL` for cards that have never been reconciled. The first
  field is the issuer snapshot for the active anchor, and the second captures
  the transaction-derived live available credit immediately before that issuer
  amount replaces it. Both are immutable between reconciliations, while
  `available_credit_centavos` remains the live value adjusted by later card
  activity. A later confirmed reconciliation may atomically replace both
  snapshots and the timestamp, but no ordinary edit or derived balance update
  may do so.
- Add an explicit ISO-8601 `forecast_recorded_at` instant to the local and
  Supabase credit-card purchase and payment records. Capture it when Odin
  records the event, expose it in repository mappings and forecast inputs, add
  it to queue payloads, API field allowlists/validation, the credit-card RPC
  payload validation and handlers, and local pull convergence allowlists.
  Compare it directly to `available_credit_reconciled_at`: events at or before
  the instant are pre-anchor, events strictly after it are post-anchor.
  Backfill legacy rows from their persisted `created_at` timestamp and retain
  their estimated label; do not compare date-only transaction or payment fields
  to a timestamp or imply that this timestamp is the real-world purchase time.
- Change `reconcileCreditCardAvailableCredit` to atomically write the live
  issuer amount, both immutable-between-reconciliations snapshots, and anchor
  timestamp and queue all four fields. Permit this exact set only through the
  issuer reconciliation branch in
  `apply_credit_card_sync_operation`; validate the timestamp and ownership,
  preserve idempotency/version conflicts, and do not let ordinary card-detail
  edits or purchase/payment-derived available-credit updates overwrite either
  anchor field.
- Extend the local account-create repair payload and remote/core detail payload
  handling to retain previously reconciled snapshots and timestamp during
  offline creation and pull convergence. Keep the entity as `credit_card_details`, so its
  existing `SyncableEntity`, API route selection, RPC handler, and pull-table
  list remain the sole sync contract rather than creating a parallel entity.

### 2. Anchor Forecast Math Without Rewriting History

- Touch `apps/app/features/debt-manager/creditCardForecast.ts`,
  `apps/app/features/debt-manager/DebtManagerScreen.tsx`, and
  `apps/app/features/debt-manager/DebtManagerOverview.tsx`.
- Extend `CreditCardForecastInput` with the reconciliation snapshots,
  timestamp, and `forecast_recorded_at` event instants. If present, reconstruct pre-anchor history
  backwards from `pre_reconciliation_available_credit_centavos`, applying only
  pre-anchor events, then emit the issuer reconciliation point from `limit -
  reconciled available credit`. Apply only strictly post-anchor event deltas to
  that issuer point to calculate the current point, then seed future repayment
  projection from that resulting current balance. This preserves an estimated
  pre-anchor chart across restart and makes the visible discontinuity at the
  anchor equal the real issuer-vs-ledger discrepancy rather than an artifact of
  back-casting from the issuer value.
- Pass the complete anchor/event input to the overview's independent
  `buildCreditCardForecast` call as well as the card-detail hook, so the global
  debt series, overview totals, and detail forecast share exactly the same
  reconciliation boundary and current debt calculation.
- Remove the regular-balance/installment-balance split from issuer-anchored
  forecast math. The issuer snapshot establishes aggregate current card debt;
  never use pre-anchor purchases, installment principal, or statement history
  to manufacture allocation components for that amount. Reconcile the
  calculated aggregate current point against the live available-credit cache as
  a discrepancy signal rather than adding one to the other.
- Treat a recorded authoritative statement as one aggregate repayment node:
  its statement balance is the total subject to the selected card strategy and
  its minimum due is the minimum-payment requirement. Do not separately deduct
  installment principal or historical purchases from that node. After a
  statement, the issuer anchor remains the current aggregate debt, with only
  strictly post-anchor purchases and payments changing it; installments may be
  shown as explanatory schedule metadata only.
- When no authoritative statement exists, forecast only aggregate balance
  movement from the issuer anchor and post-anchor events. Mark the next
  statement total and minimum due as estimated or unavailable and do not
  invent a repayment target or regular-versus-installment payment components.
- Make the anchor a forecast-hook fingerprint input through the existing full
  input fingerprint, ensuring reconciliation immediately invalidates any
  cached result after `load()` refreshes card details.

### 3. Explain Authority And Estimated History In The UI

- Touch `apps/app/features/debt-manager/CreditCardAvailableCreditReconciliation.tsx`,
  `apps/app/features/debt-manager/CreditCardForecastSection.tsx`, and focused
  card-detail tests in `apps/app/features/debt-manager/__tests__/`.
- On confirmation, state that the issuer amount becomes the current forecast
  balance as of the recorded instant and that it does not edit past records. Show
  the latest anchor timestamp on the detail/forecast surface when one exists, and
  label pre-anchor transaction-derived chart/table points as estimated or a
  reconciliation discrepancy rather than presenting them as current truth.
- Keep the existing two-step confirmation and error handling. Do not imply that
  a reconciliation fixes, deletes, or changes a historical statement or ledger
  entry.

### 4. Cover The Boundary And Sync Regression Cases

- Touch `apps/app/features/debt-manager/__tests__/creditCardForecast.test.ts`,
  `apps/app/features/debt-manager/__tests__/DebtManagerScreen.test.tsx`,
  `apps/app/features/debt-manager/__tests__/DebtManagerOverview.test.tsx`,
  `apps/app/local-db/repositories/__tests__/financialFoundations.test.ts`,
  `apps/api/src/__tests__/services/syncApplyOperation.creditCardTransactions.test.ts`,
  and `apps/api/src/__tests__/services/creditCardAvailableCreditReconciliation.integration.test.ts`.
- Add pure forecast scenarios with a same-calendar-day purchase before and
  after the anchor instant, asserting only the latter affects the current and
  future forecast. Assert pre-anchor history is reconstructed from the saved
  pre-reconciliation estimate after a simulated reload, the issuer point shows
  the expected discrepancy, and a second reconciliation supersedes the prior
  snapshots while an unreconciled card retains existing behavior. Cover an
  authoritative statement as one aggregate strategy/minimum-due node, a
  post-statement reconciliation that does not subtract installment data twice,
  and a no-statement state with no invented repayment components.
- Assert local and remote event-timestamp persistence end-to-end: migrations,
  repository reads, queue payloads, API allowlists/validation, RPC handling,
  and pulls preserve `forecast_recorded_at`; legacy `created_at` backfills are
  estimated. Assert anchor payloads and event instants are valid, the RPC
  persists the complete anchor atomically, retries do not change it twice,
  cross-user/version-conflicted writes fail, and later payments adjust live
  available credit without changing anchor fields. Add overview coverage
  proving its global trend uses the same reconciled card points as the detail
  forecast.

### 5. Verify

- Run `pnpm --filter app test -- creditCardForecast.test.ts DebtManagerScreen.test.tsx DebtManagerOverview.test.tsx financialFoundations.test.ts`,
  `pnpm --filter api test:unit -- syncApplyOperation.creditCardTransactions.test.ts`,
  `pnpm --filter app exec tsc --noEmit`, and `pnpm --filter api build`.
- Run `pnpm exec supabase migration list --linked` and
  `pnpm exec supabase db push --dry-run`; do not deploy. With local Supabase
  credentials, run the targeted reconciliation integration test as well.
- Manually smoke: record historical purchase/payment activity, reconcile to a
  deliberately different issuer available-credit amount, verify the displayed
  current balance equals the issuer anchor, then record a new purchase and a
  new payment and verify each changes only the post-anchor forecast.

## Acceptance Criteria

- Reconciliation stores an authenticated user's issuer available credit, the
  immediately preceding transaction-derived estimate, and an explicit as-of
  instant in local and remote card details.
- At the reconciliation point, card debt equals `credit limit - reconciled
  available credit`, regardless of pre-anchor ledger totals; the current point
  then reflects only post-anchor transaction and payment deltas.
- Purchases and payments with `forecast_recorded_at` strictly after the anchor
  update the forecast exactly once; events at or before it are never added to the
  issuer anchor, including events on the same calendar date.
- Pre-anchor history remains available and is visibly identified as
  transaction-derived estimated/discrepant history, not current issuer truth.
- The issuer and pre-reconciliation snapshots are immutable between confirmed
  reconciliations. A later confirmed reconciliation replaces the prior anchor;
  ordinary card edits and derived available-credit updates retain it.
- An authoritative statement supplies one aggregate strategy target and minimum
  due, with no regular-versus-installment allocation. Without a statement, the
  forecast has aggregate debt movement only and labels statement/payment values
  as estimated or unavailable.
- The global Debt Manager trend and the selected-card detail use the same
  reconciliation input and produce matching card debt points.
- The local queue, API allowlist/validation, credit-card RPC, and user-scoped
  pull path carry the new field, and the forward Supabase migration validates
  in dry-run without deployment.

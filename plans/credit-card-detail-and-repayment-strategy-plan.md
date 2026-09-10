# Credit-Card Detail And Repayment Strategy Plan

## Goal

Replace the current all-cards billing-cycle screen with a Credit Cards list and
per-card detail flow. The detail screen will retain the current card information
and cycle history while adding selected repayment strategies, payment-schedule
status, a payoff forecast chart, complete early-settlement handling, native
date selection for credit-card forms, and the missing sync contracts.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/feature-modules.md`,
  sections 4.2 through 4.6 and 7.2 through 7.8.6.
- Requested UX: Debt Manager -> View Credit Cards -> Credit Cards list ->
  selected credit-card detail page.
- Existing UI: `apps/app/features/debt-manager/DebtManagerScreen.tsx`,
  `CreditCardCollections.tsx`, and `CreditCardStatementForm.tsx`.
- Existing persistence: `apps/app/local-db/repositories/creditCard*.ts` and
  `apps/app/local-db/repositories/ledger.ts`.
- Existing sync boundaries: `apps/app/local-db/types.ts`,
  `apps/app/local-db/sync/queueOrder.ts`,
  `apps/app/local-db/sync/pullConvergence.ts`,
  `apps/api/src/services/syncApplyOperation.ts`,
  `apps/api/src/services/syncService.ts`, and `supabase/migrations/`.

## Non-Goals

- Do not build bank connectivity, statement importing, or automatic issuer
  reconciliation.
- Do not change global Snowball/Avalanche behavior for non-credit-card debts.
- Do not make statement payments automatically complete installments.
- Do not change every date field in the app; this work applies only to
  credit-card account, cycle, statement, payment, purchase, and settlement
  workflows.
- Do not deploy Supabase migrations without explicit approval.

## Execution Order

## PR Stacking Strategy

Keep the remote contract below the calculations and UI so each PR stays
reviewable and the detail screen never depends on unsynced persistence.

```text
main
└─ feat/credit-card-contracts
   └─ feat/credit-card-repayment-forecast
      └─ feat/credit-card-detail-screen
```

Create the first branch with:

```bash
git switch -c feat/credit-card-contracts
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Normalize Repayment Strategies And Complete Sync

- Touch `docs/requirements-engineering/feature-modules.md`,
  `apps/app/local-db/repositories/creditCardRepaymentPlans.ts`,
  `apps/app/local-db/migrations/`, `apps/app/local-db/types.ts`,
  `apps/app/local-db/sync/queueOrder.ts`,
  `apps/app/local-db/sync/pullConvergence.ts`,
  `apps/api/src/services/syncApplyOperation.ts`,
  `apps/api/src/services/syncService.ts`, focused API tests, and forward
  migrations under `supabase/migrations/`.
- Extend the requirements with Percentage as a fourth per-statement strategy,
  explicitly defining it as a percentage of the authoritative statement
  balance; validate its derived target is at least the minimum due and no more
  than the statement balance. Use one canonical enum across local storage, API
  validation, and Supabase, and route both
  `credit_card_statement_strategies` and `credit_card_settlements` to
  `apply_credit_card_sync_operation` rather than the generic RPC.
- Add server-side ownership and lifecycle checks for the strategy statement,
  including Full = statement balance, Minimum = minimum due, Percentage and
  Custom bounds, plus finance-charge warnings for every target below the full
  balance. Preserve one selected strategy per active authoritative statement;
  do not use Snowball or Avalanche for statement targets.

### 2. Finish Early Settlement And Payment-Schedule Calculations

- Touch `apps/app/local-db/repositories/creditCardSettlements.ts`,
  `apps/app/local-db/repositories/creditCardInstallments.ts`, new pure helpers
  in `apps/app/features/debt-manager/`, the corresponding local migration if
  constraints are missing, and focused repository/calculation tests.
- Create a pure card forecast helper that projects each cycle's selected
  statement target and active installment amortizations, returning points for
  the line graph plus `ahead`, `on_schedule`, or `behind` based on payments
  recorded against the selected target through the current as-of date. Inject
  the as-of date in tests and keep every amount in centavos until rendering.
- Complete the settlement lifecycle with requested, recognized, and rejected
  states; record optional pre-termination fees, keep the installment active
  for requested/rejected records, and mark it completed only through explicit
  issuer recognition. Recognition must be an owned, atomic local and remote
  mutation that leaves statements and ordinary payments untouched.

### 3. Split Credit-Card List And Detail Navigation

- Touch `apps/app/components/MobileShell.tsx`,
  `apps/app/features/debt-manager/DebtManagerScreen.tsx`, and add focused
  `CreditCardListScreen.tsx` and `CreditCardDetailScreen.tsx` components with
  their tests under `apps/app/features/debt-manager/`.
- Keep Debt Manager's existing View Credit Cards action, make the destination a
  list of active cards, and open a detail route carrying only an opaque
  `accountId`. The detail screen loads and renders only the selected owned card
  and returns to the card list; payment navigation must return to that same
  card detail instead of the all-cards screen.
- Move card-scoped presentation out of `CreditCardCollections.tsx` rather than
  filtering a monolithic component in place. The list shows name, issuer,
  credit limit, available credit, and current cycle summary; the detail shows
  the current card header, cycle history, purchases, statements, payments,
  installments, empty/loading/stale/error states, and existing destructive
  confirmations.

### 4. Build Detail-Screen Repayment And Forecast Sections

- Touch the new detail-screen components, new focused presentational
  components for repayment strategy, payment status, early settlement, and
  `apps/app/features/forecast/ForecastLineChart.tsx` or a small card-specific
  chart wrapper reusing its `react-native-chart-kit/v2` conventions.
- On every active authoritative statement, show Full Amount, Minimum Due,
  Percentage, and Custom choices, the derived target, a below-full finance
  charge warning, and an explicit required-strategy state before due-date
  planning. Percentage uses a numeric percentage input; Custom uses a direct
  peso amount and is labelled not recommended, while retaining the required
  minimum and less-than-full validation.
- Render the forecast as a line chart of remaining planned payment obligation
  per billing cycle, with accessible textual values and a no-data state. Show
  Ahead, On Schedule, or Behind beside the graph with plain-language guidance;
  do not claim an issuer-provided payoff projection.

### 5. Replace Credit-Card Text Dates With Native Pickers

- Touch `DebtManagerScreen.tsx`, `CreditCardStatementForm.tsx`, the new early
  settlement component, `NewTransactionScreen.tsx` only where it handles
  credit-card posting dates, and account-form copy in
  `FinancialAccountsScreen.tsx`.
- Replace editable ISO-date text fields in the credit-card cycle and early
  settlement forms with the existing platform-native `DateTimePicker` pattern,
  preserving iOS modal confirmation and Android dismissal behavior. Initialize
  each picker to today when that date is valid; for constrained fields clamp to
  the nearest valid date, such as the cycle cutoff for statement dates, rather
  than silently saving an invalid today value.
- Use the exact required placeholders, including `Enter default cut-off day`,
  and preserve values plus clear only the corrected field error after a failed
  validation. Dates already selected through native pickers remain native and
  gain only the today-default behavior where absent.

### 6. Verify The Complete User And Sync Flows

- Add tests for list-to-detail navigation, card isolation, strategy selection
  and validation, percentage target rounding, schedule status, forecast
  points, settlement request/recognition, native-date defaults, required
  placeholders, and all exact product messages. Add API and migration tests
  proving strategy and settlement operations reach the credit-card RPC and
  reject cross-user or invalid references.
- Run `pnpm --filter app test -- --runInBand`, `pnpm --filter api test:unit`,
  `pnpm --filter api build`, `pnpm --filter app exec tsc --noEmit`, and
  `pnpm test`. Run `supabase migration list --linked` and
  `supabase db push --dry-run` without deployment, then execute a Maestro
  credit-card smoke flow if an emulator or device is available.

## Acceptance Criteria

- Debt Manager opens a Credit Cards list, and selecting a card opens a detail
  page that never renders another card's records.
- The detail page includes card information, cycle history, purchases,
  authoritative statements, payments, installments, early settlement, and
  required empty/loading/stale/error states.
- Every active authoritative statement has an independently persisted Full,
  Minimum, Percentage, or Custom strategy before due-date planning; selected
  targets feed the card forecast and debt-budget requirement.
- The page presents an accessible cycle-based forecast line graph and accurate
  Ahead, On Schedule, or Behind state from recorded payments and selected
  targets.
- Early settlements include date, amount, remaining principal, optional fee,
  and status, and cannot complete an installment before issuer recognition.
- All credit-card date inputs use native selectors and default to a valid
  today-based value; account cutoff copy matches the required placeholder.
- Strategy and settlement mutations validate ownership, sync through the
  credit-card RPC, use matching local/API/Supabase enum values, and converge
  through pull sync.

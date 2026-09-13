# Debt Manager Overview Summaries Execution Plan

## Goal

Add the missing Debt Manager overview summaries beside the existing Total debt trend: an overall debt-paid total, an overall progress summary, and a recorded payment trend summary. Derive all three from the same user-scoped credit-card and non-credit-card data already loaded by `DebtManagerOverview`, with one shared aggregate calculation seam so displayed totals cannot diverge from the forecast graph.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/feature-modules.md`, sections 7.1 and 7.2.
- Current overview aggregation: `apps/app/features/debt-manager/DebtManagerOverview.tsx` and `apps/app/features/debt-manager/globalDebtForecast.ts`.
- Non-credit-card forecast and payment rules: `apps/app/features/debt-manager/debtForecast.ts` and `apps/app/local-db/repositories/debtPayments.ts`.
- Credit-card forecast and payment records: `apps/app/features/debt-manager/creditCardForecast.ts` and `apps/app/local-db/repositories/creditCardPayments.ts`.
- Existing presentation patterns and tests: `apps/app/features/debt-manager/GlobalDebtTrend.tsx` and `apps/app/features/debt-manager/__tests__/`.

## Non-Goals

- No new persisted summary tables, API endpoints, sync entities, or Supabase migrations; these are derived overview values.
- No changes to debt forecast rules, credit-card repayment strategies, statement lifecycle, or payment recording behavior.
- No claim that a credit-card amount was paid toward principal when the source data only records a statement payment.
- No historical analytics beyond the available local payment and forecast records; missing starting-baseline data must render as unavailable rather than an invented percentage.

## Execution Order

## PR Stacking Strategy

Keep this as a small single-slice change because the required data is already local and the calculation seam can be tested independently of the screen.

```text
main
└─ feat/debt-manager-overview-summaries
```

```bash
git switch -c feat/debt-manager-overview-summaries
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Define The Aggregate Summary Contract

- Touch `apps/app/features/debt-manager/globalDebtForecast.ts` or add a focused `debtManagerSummary.ts`, plus its unit tests. Define typed summary inputs and outputs for recorded amount paid, current total debt, progress, and payment-series points; aggregate non-credit payments and credit-card statement payments by date without mixing forecast-only contribution targets into recorded payment totals.
- Preserve user ownership by accepting only repository results already queried with `userId`; use the existing combined forecast as the balance source. Decide and document the progress denominator in the implementation: use a real tracked starting balance where available, otherwise expose an unavailable/indeterminate state instead of manufacturing a percentage from credit limit or forecast data.

### 2. Build The Overview Summary Data

- Touch `apps/app/features/debt-manager/DebtManagerOverview.tsx`. Extend the existing `useMemo` aggregation to retain per-card forecast/payment context and per-debt payment context, then produce one summary model alongside `globalTrend`; keep the existing `buildCreditCardForecast`, `buildDebtForecast`, and `combineDebtBalanceSeries` calls as the only forecast sources.
- Ensure the summary handles active, paid-off, empty, and mixed debt sets, uses the same Philippine as-of date, sorts payment points chronologically, and does not turn a failed overview load into partially misleading totals.

### 3. Add Focused Summary Components

- Add presentation components under `apps/app/features/debt-manager/`, such as `DebtOverviewSummary.tsx` and `DebtPaymentTrend.tsx`, and render them from `DebtManagerOverview.tsx` before `GlobalDebtTrend`. Show the paid total with its scope, current total and progress copy, and a compact recorded-payment trend with a clear time grouping and empty state.
- Match the existing Debt Manager visual language and accessibility conventions; distinguish actual recorded payments from projected future payments, show `Not available` or explanatory copy for indeterminate progress, and keep layout usable on narrow mobile screens without magic positioning.

### 4. Verify Aggregation And UI Behavior

- Add tests in `apps/app/features/debt-manager/__tests__/` covering mixed credit-card/non-credit debt totals, duplicate-day payments, zero payments, paid-off debts, no-credit-card data, chronological payment trend grouping, and unavailable starting-baseline behavior. Add a focused overview rendering test that asserts the three summaries and confirms the existing Total debt trend remains present.
- Run `pnpm --filter app test -- --runInBand` and `pnpm --filter app exec tsc --noEmit`; run `pnpm test` if the API workspace is available. If an emulator is available, run a Maestro Debt Manager smoke flow to verify the summaries render with both debt types.

## Acceptance Criteria

- Debt Manager displays an overall recorded debt-paid total sourced from non-credit debt payments and credit-card statement payments.
- Debt Manager displays current overall debt and a progress summary that never treats forecast contributions or credit limits as recorded payments or principal reduction.
- Debt Manager displays a payment trend summary grouped by date or supported period, with actual payments clearly separated from forecast data.
- All summaries are calculated from the same user-scoped data and forecast inputs as the existing Total debt trend.
- Empty, partial, paid-off, and unavailable-baseline states are explicit and non-misleading.
- Existing debt trend, credit-card sections, non-credit-card sections, and forecast behavior remain unchanged.
- Focused tests and TypeScript verification pass; no database or remote migration is required.

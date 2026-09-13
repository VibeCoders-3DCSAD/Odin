# Credit-Card Forecast Cache Execution Plan

## Goal

Keep each credit-card detail forecast in page-local memory while its input is
unchanged, invalidate it when forecast-affecting card data changes, and compute
new results cooperatively so the detail page stays usable while the chart is
being prepared. Repayment-strategy previews will continue to update the
forecast before saving.

## Source Of Truth

- User request: cache a credit-card forecast until the detail page unmounts or
  relevant transaction or statement data changes; show a loading state and keep
  forecast work nonblocking.
- Forecast calculation: `apps/app/features/debt-manager/creditCardForecast.ts`.
- Card detail orchestration: `apps/app/features/debt-manager/DebtManagerScreen.tsx`.
- Strategy preview UI: `apps/app/features/debt-manager/CreditCardRepaymentStrategy.tsx`.
- Statement and payment callbacks: `apps/app/features/debt-manager/CreditCardCollections.tsx`
  and `apps/app/features/debt-manager/CreditCardStatementForm.tsx`.
- Ledger mutations: `apps/app/features/ledger/NewTransactionScreen.tsx` and
  `apps/app/local-db/repositories/ledger.ts`.

## Non-Goals

- Do not persist forecasts to SQLite, sync them, or add a server-side cache.
- Do not alter forecast math, repayment strategy validation, or statement
  lifecycle rules.
- Do not add statement edit or delete UI; those actions are not currently
  implemented. The invalidation boundary will handle them when introduced.
- Do not block the entire credit-card detail page with a full-screen loader;
  only the forecast area waits while the rest of the page remains interactive.

## Execution Order

## PR Stacking Strategy

Keep this as one focused frontend PR. The calculation seam and hook land before
the screen integration so cache behavior can be reviewed independently.

```text
main
└─ feat/credit-card-forecast-cache
   ├─ frontend: add cooperative forecast calculation and cache hook
   └─ frontend: show forecast loading state and cover invalidation
```

Create the branch with:

```bash
git switch -c feat/credit-card-forecast-cache
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Add A Page-Local Async Forecast Hook

- Touch `apps/app/features/debt-manager/creditCardForecast.ts` and add
  `apps/app/features/debt-manager/hooks/useCreditCardForecast.ts`, plus focused
  tests under `apps/app/features/debt-manager/__tests__/`.
- Preserve the existing synchronous pure forecast function for calculation-unit
  tests and non-detail consumers. Add an async variant that cooperatively yields
  while processing large movement and projection collections; simply wrapping a
  synchronous calculation in a resolved promise is not sufficient because it
  still blocks the React Native JavaScript thread.
- The hook accepts the selected card's already-scoped inputs and preview or
  saved strategy. Store only the latest input fingerprint, result, and active
  request version in refs; return the cached result immediately for an identical
  fingerprint, set `isLoading` for a new fingerprint, and ignore a completed
  request if a newer request started or the component unmounted.
- Make the fingerprint include only calculation inputs: selected account limit
  and available credit, card cycles, card transactions, statements, payments,
  installments, as-of date, and effective strategy values. This makes strategy
  selection and edits to any listed entity invalidate the cache without a
  separate mutable global cache or user data in client storage keys.

### 2. Use The Hook And Render A Nonblocking Forecast State

- Touch `apps/app/features/debt-manager/DebtManagerScreen.tsx` and
  `apps/app/features/debt-manager/CreditCardForecastSection.tsx`.
- Replace render-time `buildCreditCardForecast(...)` with the hook and pass its
  result/loading state to the forecast section. Keep the existing page data
  loader and mutation callbacks: saving a strategy, recording or deleting a
  statement payment, and recording a statement call `load()`, update the
  relevant arrays, change the fingerprint, and schedule exactly one replacement
  computation.
- Render an accessible forecast-specific loading panel with an activity
  indicator and plain-language message while there is no result for the current
  fingerprint. When replacing an already rendered forecast, retain the previous
  chart with a small updating indicator rather than blanking the entire detail
  page; only render a new chart after the matching request resolves.
- Continue treating `previewStrategy` as the effective strategy. A radio or
  input change starts a new calculation without saving, and a subsequent save
  refreshes data and replaces the preview with the persisted strategy. The hook
  cache naturally disappears when `MobileShell` changes away from
  `credit-card-detail`, because `DebtManagerScreen` unmounts.

### 3. Define Mutation Invalidation At The Existing Boundaries

- Touch `apps/app/features/debt-manager/CreditCardCollections.tsx`,
  `apps/app/features/debt-manager/CreditCardStatementForm.tsx`, and, only if
  needed to make the return route explicit, `apps/app/components/MobileShell.tsx`.
- Route every successful card-detail mutation through the same reload path,
  including create/update/delete of a transaction or statement payment and
  create/update/delete of a statement when those latter operations are added.
  Do not invalidate on a failed or cancelled mutation.
- Confirm the current navigation behavior already gives the required guarantee
  for ledger transaction create/edit/delete: opening `add-transaction` replaces
  the detail component, so it unmounts and drops its cache; returning mounts a
  fresh detail page and reads current local data. Do not introduce a global
  event bus solely for a cache that cannot survive that route change.
- Keep entity ownership filtering in existing repositories and pass only the
  selected account's collections into the hook, so a change to another card
  cannot affect the selected card's cached forecast.

### 4. Test Cache, Invalidation, And Loading Behavior

- Touch `apps/app/features/debt-manager/__tests__/creditCardForecast.test.ts`
  and `apps/app/features/debt-manager/__tests__/DebtManagerScreen.test.tsx`; add
  a hook test file if the repository's React Native test setup needs lifecycle
  coverage isolated from the screen.
- Verify an unchanged input fingerprint calls the async builder once across
  unrelated screen re-renders; a strategy preview, transaction data change,
  statement data change, payment change, and account available-credit change
  each schedule one new result. Verify an outdated async result cannot overwrite
  a newer preview or a result after unmount.
- Verify the forecast loading message is accessible, the rest of the selected
  card detail remains rendered while computation is pending, the prior chart is
  marked as updating during refresh, and the completed chart receives the newest
  strategy target. Keep existing pure forecast scenarios passing unchanged.

### 5. Verify

- Run `pnpm --filter app test -- --runInBand` and
  `pnpm --filter app exec tsc --noEmit`.
- Manually smoke on an emulator if available: open a card detail, wait for the
  forecast loader to resolve, change each strategy option and a numeric value,
  save it, record and delete a statement payment, leave for transaction entry,
  save or edit a card transaction, then return and confirm each forecast is
  refreshed without blocking the detail page.

## Acceptance Criteria

- An unchanged selected card and strategy reuse the page-local forecast without
  recalculating it, and navigating away from the detail page discards the cache.
- A repayment strategy preview or saved strategy change produces a forecast from
  the new strategy and no stale async result replaces it.
- Creating, editing, or deleting a selected card transaction, statement, or
  statement payment results in a fresh forecast on the next active detail view.
- Forecast work yields to the UI and the detail screen remains responsive with a
  clear, accessible forecast loading or updating state.
- Forecast inputs and results remain scoped to the authenticated user's selected
  credit-card account and are never persisted or synced as cached data.

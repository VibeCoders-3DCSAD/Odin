# Forecast Integration Execution Plan

## Goal

Ship the Spending Forecast module end to end: an authenticated Express API route that reads the user's transaction history and returns a forecast snapshot payload (using a deterministic **mock generator first**, ML endpoint later), an app-side caller that writes that snapshot into local storage on dashboard refresh, and a real Spending Forecast screen replacing the current `ShellPlaceholderPage`. `ForecastPanel` and `getForecastContent()` already exist and render the data — no changes needed there.

## Source Of Truth

- Requirements: `docs/requirements-engineering/feature-modules.md` §14 (Forecasting and Financial Intelligence Module)
- ML endpoint (later): `../odin-ml/app/api/forecast.py` — `POST /api/v1/forecast/predict`
- Local schema: `apps/app/local-db/migrations/013_dashboard_snapshots.ts`
- Forecast parser: `apps/app/features/dashboard/dashboardSnapshotContent.ts` (`getForecastContent`)
- Forecast panel: `apps/app/features/dashboard/components/ForecastPanel.tsx`
- Dashboard data flow: `apps/app/features/dashboard/hooks/useDashboardData.ts`

## Non-Goals

- No wiring to `odin-ml` yet. The API returns mock forecast data in the same shape the ML endpoint will later return.
- No anomaly / overspending detection, suppression rules, or expected-event generation from real data.
- No new dependencies.
- No changes to synced tables, sync engine, migrations, or existing ledger/taxonomy/recurring modules.

## Execution Order

1. Build the mock forecast service + API route.
2. Build the app-side forecast fetch and snapshot writer.
3. Build the Spending Forecast screen and wire navigation.
4. Verify.

## PR Stacking Strategy

Single working branch, one PR, commits per phase.

```text
main
└─ feat/forecast-integration
   ├─ api: forecast route + mock service
   ├─ app: forecast fetch + snapshot upsert
   └─ app: spending-forecast screen
```

```bash
git switch -c feat/forecast-integration
# implement phase 1, commit
# implement phase 2, commit
# implement phase 3, commit
# run full verification suite
```

## Linear Sub-Issue Tracking

Create sub-issues from this plan when ready. Suggested scope per sub-issue matches the numbered phases below.

### 1. Mock Forecast Service And API Route

- Add `apps/api/src/services/forecastService.ts`: a pure function that takes the user's transactions (label, date, amount_centavos, transaction_type, subcategory) and returns a deterministic forecast payload. Map the four forecast types the panel renders:
  - `projected_balance_centavos` (opening balance + projected income − projected expense)
  - `income_centavos`, `expense_centavos`
  - `categories: [{ label, amount_centavos }]`
  - `expected_events: [{ label, date }]`
  - plus `insights`, `text`, `period`, `freshness`, `confidence`
- Use a simple, explainable rule (e.g. 3-month average income/expense per category by recurring/occurrence data) rather than a fake random number, so later swapping the ML provider keeps the contract intact. Mark deliberate simplifications with `ponytail:` comments.
- Add `apps/api/src/routes/forecast.ts`: `GET /odin/api/forecast` using `requireAuth` (mirror `apps/api/src/routes/me.ts`), reads the user's transactions from Supabase via the authenticated client (scoped `.eq("user_id", userId)`), and returns `{ payload: { ...forecast } }`. Handle the empty-history case by returning an empty-data payload (no 4xx) so the panel shows the per-spec empty message.
- Register the route in `apps/api/src/app.ts` (`app.use("/odin/api/forecast", forecastRoutes)`).
- Add `apps/api/src/__tests__/routes/forecast.test.ts` mirroring `data-export-requests.test.ts` (mock supabase, auth header): 200 with payload for transactions, 200 empty-data for no transactions, 401 unauthenticated.
- Mock flag: gate the mock with an env var (e.g. `FORECAST_PROVIDER=mock`) so the ML swap is one config change.

### 2. App-Side Forecast Fetch And Snapshot Writer

- Add the client caller. The existing per-feature API clients live under `features/*/api.ts` (`features/onboarding/api.ts` is the template: `apiFetch` → `API_BASE_URL` + timeout). Add `apps/app/features/forecast/api.ts` with `getForecast(accessToken)` calling `/odin/api/forecast`.
- Add the local snapshot writer path. `upsertSnapshot(userId, "forecast", payload)` in `apps/app/local-db/repositories/dashboardSnapshots.ts` already exists with **zero callers** — this is where the fetched payload is written.
- Wire into `apps/app/features/dashboard/hooks/useDashboardData.ts`: after a successful `runSync`, fetch the forecast and `upsertSnapshot`, then `load()` so `getAllSnapshots` picks it up. Keep it non-blocking: forecast failure should not mark the whole dashboard refresh as failed (per §3.4 partial-data states).

### 3. Spending Forecast Screen And Navigation

- The `spending-forecast` page in `apps/app/components/MobileShell.tsx` currently falls through to `ShellPlaceholderPage` (`renderPage`, line ~812). Add a real screen `apps/app/features/forecast/SpendingForecastScreen.tsx` that reads the forecast snapshot (via `getSnapshot`/`getForecastContent`), reuses `ForecastPanel`, shows the forecast trust badges (personalized / fallback / cold-start, freshness, confidence, last update) per §14.2, and renders loading / empty-data / error messages from §14.5.
- Register it in `MobileShell.tsx` `renderPage()` (`if (currentPage === "spending-forecast")`), passing `userId`, `deviceId`, `accessToken`, and refresh.

### 4. Verify

- `pnpm --filter api test` (new suite + existing).
- `pnpm --filter app test` (add a focused test for the forecast snapshot parser if none exists; the `dashboardSnapshotContent.test.ts` already covers parsing).
- `pnpm` typecheck / build for both apps.
- Manual smoke: record transactions in the ledger → refresh dashboard → forecast panel shows projected values → tap "View forecast details" → real screen renders; with no transactions → empty-data message.

## Acceptance Criteria

- A signed-in user with transaction history sees a populated Spending Forecast panel on the dashboard and a full forecast on the `spending-forecast` page.
- A signed-in user with no transactions sees the spec-correct empty-data message, not an error or a misleading chart.
- The forecast snapshot is refreshed on dashboard refresh and cached locally; stale/offline states render per §14.4–14.5.
- Unauthenticated requests to `/odin/api/forecast` return 401; all reads are scoped to the authenticated user.
- The API contract matches the shape `getForecastContent()` already parses (`projected_balance_centavos`, `income_centavos`, `expense_centavos`, `categories`, `expected_events`, `insights`, `period`, `freshness`, `confidence`, `text`).
- Switching `FORECAST_PROVIDER` from `mock` to the ML endpoint later does not require changes to the app caller or the panel.
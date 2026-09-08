# Forecast ML Integration Execution Plan

## Goal

Replace Odin's deterministic mock forecast provider with the ready `odin-ml` forecasting service while retaining the app's offline-first flow: read the signed-in user's posted history from the local SQLite repository after sync, send it through an authenticated Odin API adapter, cache the normalized forecast locally, and present the service's supported spending horizons and levels without inventing income, balance, or event predictions.

## Source Of Truth

- Forecasting microservice contract supplied with this request: `POST /api/v1/forecast/predict`.
- Existing mock boundary: `apps/api/src/routes/forecast.ts` and `apps/api/src/services/forecastService.ts`.
- Existing forecast refresh/cache flow: `apps/app/features/dashboard/hooks/useDashboardData.ts` and `apps/app/local-db/repositories/dashboardSnapshots.ts`.
- Existing transaction repository: `apps/app/local-db/repositories/ledger.ts`.
- Existing forecast UI: `apps/app/features/forecast/` and `apps/app/features/dashboard/components/ForecastPanel.tsx`.

## Non-Goals

- Do not call the unauthenticated ML service directly from the mobile app or expose its URL as `EXPO_PUBLIC_*` configuration.
- Do not persist raw transaction history, request bodies, or user IDs in forecast snapshots or logs.
- Do not add batch prediction, target-category filtering, model training, or a database/sync migration; forecast snapshots remain local, derived cache data.
- Do not represent unsupported predictions as product facts: no projected account balance, income prediction, expected events, daily forecast, or yearly forecast.

## Execution Order

Execute the numbered phases below in order: establish the local/client contract, add the secure adapter, migrate the cached presentation, then verify the complete boundary.

## PR Stacking Strategy

Use a three-PR stack so the client contract, secure adapter, and presentation migration remain independently reviewable.

```text
main
└─ feat/forecast-ml-contract
   └─ feat/forecast-ml-adapter
      └─ feat/forecast-ml-presentation
```

Merge in that order. With vanilla Git, create each branch from its parent; with Graphite, create the stack with `gt create` from the preceding branch and target each PR at its parent.

## Linear Sub-Issue Tracking

Create sub-issues from this plan when ready: contract/local history, API adapter, and app presentation/cache.

### 1. Define The App Forecast Contract And Local History Reader

- Touch `apps/app/local-db/repositories/ledger.ts` or add focused `apps/app/local-db/repositories/forecastTransactions.ts`, plus `apps/app/features/forecast/types.ts`; add a bounded, user-scoped query for posted `income` and `expense` transactions joined to their category labels, ordered by date, with deleted, draft, voided, and transfer records excluded.
- Normalize each local row into the ML request shape: UUID transaction ID, ISO date, `amount_centavos / 100`, category label with a safe `Other` fallback, `income`/`expense`, and an optional concise description derived from the existing merchant/counterparty/notes fields; never send the local `user_id` from the app.
- Define one app-facing forecast DTO that captures the supported `WEEKLY`, `SEMI_MONTHLY`, and `MONTHLY` horizons; `TOTAL`, `CATEGORY_GROUP`, and `CATEGORY` levels; centavo amounts; confidence bounds; model version; and `SUCCESS`/`FALLBACK` status. Keep raw ML transport types separate from this presentation DTO so snake-case microservice details do not spread through components.
- Return a local cold-start result without an HTTP call when the repository has no eligible history, because the ML contract rejects an empty transaction list with `422`.

### 2. Add The Authenticated API-To-ML Forecast Adapter

- Replace the mock-only behavior in `apps/api/src/routes/forecast.ts` and `apps/api/src/services/forecastService.ts`, or split the outbound concern into `apps/api/src/services/forecastMlClient.ts`; change the Odin endpoint to authenticated `POST /odin/api/forecast` accepting only validated app forecast options and historical transactions, then inject `request.userId` as the ML `user_id` regardless of client input.
- Add narrow request/response validators without a new dependency: whitelist the supported horizon and level values, validate ISO dates, finite positive monetary amounts, bounded string fields and transaction count, normalize outgoing values, and reject malformed ML responses before mapping them to Odin's app DTO.
- Call `${FORECASTING_ML_BASE_URL}/api/v1/forecast/predict` with `Content-Type: application/json`, an explicit abort timeout, and no credentials. Keep this base URL server-only in `apps/api/.env.example`; require the service to be on a private/restricted network until it implements its own service authentication.
- Map ML `amount` values to integer centavos once, preserve confidence intervals and model metadata, and treat `FALLBACK` as a usable forecast with a visible fallback status. Convert adapter timeouts, unreachable services, malformed responses, and upstream validation failures to safe Odin API errors with structured logs containing only user ID, request ID, request count, HTTP status, and error class.

### 3. Refresh And Present The ML Forecast

- Touch `apps/app/features/forecast/api.ts`, `apps/app/features/dashboard/hooks/useDashboardData.ts`, and `apps/app/features/forecast/SpendingForecastScreen.tsx`; after a successful `runSync`, read local history and post it with the selected/default `MONTHLY` and `TOTAL` options, then upsert only the normalized forecast response into the existing user-scoped `forecast` snapshot.
- Keep a forecast failure independent from sync and dashboard success: retain a readable stale snapshot, distinguish no eligible local history from an unavailable service, and do not overwrite good cached data with an error response.
- Update `apps/app/features/dashboard/dashboardSnapshotContent.ts`, `apps/app/features/dashboard/components/ForecastPanel.tsx`, `apps/app/features/forecast/ForecastLineChart.tsx`, and forecast types to remove the mock-only balance/income/four-horizon assumptions. Show forecast spending for the selected weekly, semi-monthly, or monthly horizon, level-appropriate category rows, confidence ranges, model version, and a clear fallback badge; omit controls or explanatory copy for `target_categories` until the service actually filters by it.

### 4. Cover Boundaries And Verify End To End

- Update `apps/api/src/__tests__/services/forecastService.test.ts` and `apps/api/src/__tests__/routes/forecast.test.ts`; cover transaction normalization, centavo conversion, injected authenticated user ID, outbound path/body/timeout, all supported enums, malformed local input, ML `SUCCESS` and `FALLBACK` mapping, malformed upstream response, upstream `422`, outage/timeout, and unauthenticated Odin requests.
- Add focused app tests beside `apps/app/local-db/repositories/` and `apps/app/features/forecast/`; cover the user-scoped local history query, excluded transaction states/types, empty-history no-call result, snapshot replacement, stale-cache preservation after refresh failure, and rendering of all three levels and fallback confidence intervals.
- Run `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter app test`, and the app TypeScript/build check used by the repository. Manually smoke-test: create a local expense offline, reconnect and sync, refresh the forecast, verify the posted ML amount/category output and fallback label, then disable the ML service and verify the prior cached forecast remains visible as stale.

## Acceptance Criteria

- Forecast refresh uses the authenticated user's locally stored, posted transaction history after sync and never sends another user's rows.
- The mobile app never directly reaches the unauthenticated ML endpoint; only the Odin API holds `FORECASTING_ML_BASE_URL` and injects the authenticated user ID.
- The adapter sends the documented `/api/v1/forecast/predict` request shape and safely maps `SUCCESS` and `FALLBACK` responses into centavo-based app data.
- Empty local history renders a cold-start state without an ML request or a misleading service error.
- The app exposes only the ML service's weekly, semi-monthly, and monthly spending forecasts and the supported total/category-group/category levels.
- A forecast refresh failure preserves the most recent local snapshot, and no raw financial payload is logged or persisted outside the existing local forecast snapshot.
- API and app tests cover request validation, ownership boundaries, units, fallback behavior, cache behavior, and the three forecast levels.

# Budget Recommendation Forecast and History Execution Plan

## Goal

Supply the Budget Creation recommendation adapter with the authenticated user's bounded posted transaction history and a fresh, best-effort monthly category-group forecast. The mobile app remains the source of local-first transaction data, the Odin API validates and maps that context to the private ML contract, and recommendation generation continues when forecast context is unavailable.

## Source Of Truth

- Current recommendation adapter: `apps/api/src/services/budgetRecommendationService.ts`, `apps/api/src/routes/budget-recommendations.ts`, and `apps/app/features/budgeting/api.ts`.
- Budget Creation flow: `apps/app/features/budgeting/BudgetingScreen.tsx`.
- Existing local-history and forecast contracts: `apps/app/local-db/repositories/forecastTransactions.ts`, `apps/app/features/forecast/types.ts`, and `apps/app/features/forecast/api.ts`.
- ML budget request contract: `../odin-ml/app/schemas/budget.py`.
- Existing integration plan: `plans/budget-optimizer-integration-execution-plan.md`.

## Non-Goals

- Do not expose `BUDGET_ML_BASE_URL` or call the ML service directly from the mobile app.
- Do not persist recommendation context, raw transaction history, or forecast data in budget drafts, snapshots, or the sync queue.
- Do not make forecast availability a prerequisite for generating a recommendation; no-history and forecast-failure cases must retain the current preference-based recommendation path.
- Do not claim the recommendation behavior changes: `odin-ml` currently declares `transaction_history` and `forecast` but `budget_service.optimize` does not consume them. A follow-up must define and test how the solver uses the context before presenting it as forecast-aware allocation.
- Do not alter budget save, explicit acceptance, category ownership, debt-envelope, savings-envelope, or centavo-reconciliation behavior.

## Execution Order

Implement the shared app/API context contract first, then collect and forward the local data through the authenticated adapter, and finally prove that optional-context failures degrade safely without changing the existing recommendation flow.

## PR Stacking Strategy

Use a two-PR stack so the secure transport contract lands before the Budget Creation orchestration and UI-state changes.

```text
main
└─ feat/budget-recommendation-context-adapter
   └─ feat/budget-recommendation-context-ui
```

Merge in order. Create the first branch from `main`; create the second from the first and target its parent, using Graphite or vanilla Git.

## Linear Sub-Issue Tracking

Create sub-issues from this plan when ready: context contract and adapter validation; Budget Creation context collection and degradation coverage.

### 1. Define The Optional Recommendation Context Contract

- Update `apps/app/features/budgeting/api.ts` and `apps/api/src/services/budgetRecommendationService.ts` with one aligned app-facing request shape: `historicalTransactions` uses the existing forecast transaction fields, and `forecast` uses a narrow, versioned budget-context DTO derived from `ForecastPayload` rather than an unbounded `Record<string, unknown>`.
- Keep IDs, dates, text lengths, positive monetary values, transaction types, horizons, levels, forecast points, and centavo conversions validated at the API boundary. Enforce the same 500-record history limit as `listForecastTransactions`; exclude descriptions from the budget context unless the ML contract demonstrably needs them, minimizing financial data sent to the optimizer.

### 2. Forward Validated Context To The Private ML Adapter

- Update `apps/api/src/services/budgetRecommendationService.ts` to map the validated camelCase history and centavo-denominated forecast DTO to the ML service's snake_case `transaction_history` and `forecast` fields. Convert monetary values to peso units only at the outbound ML boundary, retain the authenticated `user_id` injection, and never log transaction values, labels, descriptions, or forecast contents.
- Update `apps/api/src/__tests__/services/budgetRecommendationService.test.ts` and `apps/api/src/__tests__/routes/budget-recommendations.test.ts` to cover full context forwarding, malformed/oversized context rejection before ML is called, authenticated identity injection, and requests that deliberately omit both optional fields. Preserve the existing safe `400`, `422`, and availability error behavior.

### 3. Build Context In Budget Creation Without Blocking Recommendations

- Update `apps/app/features/budgeting/BudgetingScreen.tsx`; use `listForecastTransactions(userId)` to collect the user's posted local history and call the existing authenticated `requestForecast` endpoint for a monthly `CATEGORY_GROUP` forecast. Pass history in every valid recommendation request and include forecast context only when the forecast response validates successfully.
- Extract any non-trivial request/context construction into a focused feature-local helper under `apps/app/features/budgeting/` so `BudgetingScreen` remains form orchestration. Treat the forecast request as best-effort: a missing history, failed forecast request, cancellation, or unavailable forecaster must still call the budget recommendation endpoint with the available context and retain the current cancellation and error states for the recommendation itself.

### 4. Cover Degradation And Verify The Contract

- Update `apps/app/features/budgeting/__tests__/api.test.ts` and add focused Budget Creation/helper tests under `apps/app/features/budgeting/__tests__/` for complete history-plus-forecast requests, zero-history generation, forecast failure fallback, cancelled recommendation generation, and assurance that context never changes the values applied to the manual draft except through the existing explicit apply action.
- Update `plans/budget-optimizer-integration-execution-plan.md` to remove its now-obsolete statement that transaction history and forecast are not wired, while documenting that forwarding is not solver consumption. Run `pnpm --filter api test:unit` and `pnpm --filter app test`; manually generate a recommendation with posted transactions, then repeat with no history and with the forecast API unavailable to confirm all three paths reach the expected review or degradation states.

## Acceptance Criteria

- Budget Creation sends at most 500 user-scoped posted transactions to Odin's authenticated budget recommendation endpoint.
- The API validates optional history and forecast context and maps it to the ML service's `transaction_history` and `forecast` fields using the correct casing and money units.
- The API remains the only component that knows the private ML URL and injects the authenticated user ID.
- Invalid context is rejected before any ML request, with no raw financial data written to logs.
- A fresh category-group forecast is included when available; a missing, stale, or unavailable forecast does not prevent a preference-based recommendation.
- Existing explicit review, apply, offline-save, sync, ownership, and centavo-allocation guarantees remain intact.
- Tests cover complete forwarding, no-history behavior, forecast failure degradation, boundary validation, and no implicit budget persistence.

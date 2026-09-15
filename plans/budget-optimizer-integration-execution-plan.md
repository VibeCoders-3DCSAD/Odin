# Budget Optimizer Integration Execution Plan

## Goal

Connect Odin's existing budget form to the ready `odin-ml` linear-programming optimizer through an authenticated Odin API adapter. The user supplies a period, total, debt and savings reservations, and preferred category amounts; Odin returns an editable recommendation and creates or updates the existing offline manual budget draft only after explicit acceptance.

## Source Of Truth

- Budget optimizer contract: `../odin-ml/app/schemas/budget.py` and `../odin-ml/app/services/budget_service.py`.
- Existing authenticated ML-adapter pattern: `apps/api/src/routes/forecast.ts` and `apps/api/src/services/forecastService.ts`.
- Existing budget persistence and sync contract: `apps/app/local-db/repositories/budgets.ts` and `supabase/migrations/20260821000001_fix_budget_delete_tombstone.sql`.
- Existing budget interface and reservation queries: `apps/app/features/budgeting/BudgetingScreen.tsx`, `apps/app/features/debt-manager/requiredDebtTotalQueries.ts`, and `apps/app/features/savings-goals/requiredSavingsContributionQueries.ts`.
- Product requirements: `docs/requirements-engineering/feature-modules.md` sections 6.13 through 6.17.

## Non-Goals

- Do not call `odin-ml` from the Expo app or expose its base URL as public configuration.
- Do not persist a recommendation, raw ML request, restriction settings, or model metadata in Supabase or the sync queue for this release.
- Do not introduce a new optimized-budget allocation method, alter the current manual-draft sync RPC, or automatically overwrite an existing budget.
- Do not claim that the optimizer learns from forwarded optional ML `transaction_history` or `forecast` fields until the optimizer uses them.
- Do not alter debt repayment or savings contribution allocation logic; debt and savings remain budget envelopes reserved before category optimization.

## Execution Order

Execute the phases in order: establish one narrow app/API contract, add the authenticated API-to-ML adapter, add recommendation review and explicit acceptance to the budget form, then verify the boundaries.

## PR Stacking Strategy

Use a three-PR stack to keep the secure adapter, local recommendation flow, and verification independently reviewable.

```text
main
└─ feat/budget-optimizer-adapter
   └─ feat/budget-optimizer-review
      └─ test/budget-optimizer-integration
```

Merge in that order. With vanilla Git, branch each PR from its parent; with Graphite, create each branch from the preceding branch and target its parent.

## Linear Sub-Issue Tracking

Create sub-issues from this plan when ready: API adapter, recommendation review/acceptance, and boundary coverage.

### 1. Define The Odin Budget Recommendation Contract

- Add `apps/api/src/services/budgetRecommendationService.ts` and `apps/api/src/routes/budget-recommendations.ts`; define separate app-facing camelCase DTOs and private snake_case ML transport types. The app request contains a valid period, integer-centavo total and reservations, and no more than 100 user-selected category or subcategory allocation preferences; it must not contain `userId`.
- Treat each user-entered preferred allocation as an optimizer category keyed by its owned category or subcategory ID. Calculate `availableFundsCentavos = totalAmountMinor - debtBudgetAmountMinor - savingsBudgetAmountMinor`, derive target ratios from the preferred category amounts, and use explicit first-release defaults of `FREE`, floor `0`, ceiling `availableFunds`, and priority `1`; reject missing categories, non-positive available funds, duplicate allocation targets, invalid dates, and values exceeding the total.
- Validate every supplied category and subcategory ID against the authenticated user's accessible taxonomy before sending it upstream. Preserve the selected target type in the returned Odin DTO so the app can write the recommendation back through `CreateBudgetInput` without inferring IDs from labels.

### 2. Add The Authenticated API-To-ML Budget Adapter

- Register `budget-recommendations` at `POST /odin/api/budget/recommendations` in `apps/api/src/app.ts` behind `requireAuth`; inject `request.userId` into the ML payload and never accept a client-provided identity. Configure the server-only `BUDGET_ML_BASE_URL` in `apps/api/.env.example`, or deliberately reuse the existing internal ML base URL if deployment uses one service address.
- In `budgetRecommendationService.ts`, call `${BUDGET_ML_BASE_URL}/api/v1/budget/recommend` using JSON, an explicit abort timeout, and no forwarded end-user credentials. Validate the full ML response before mapping: every returned ID must correspond to a requested target, allocations must be finite non-negative money values, and their rounded centavos must exactly exhaust the category funds after a deterministic final-centavo reconciliation.
- Return safe `400` validation, upstream `422`, and unavailable `503` responses using the forecast route's error pattern. Log only request ID, authenticated user ID, category count, upstream status, and error class; never log budget amounts, category labels, or the full payload.

### 3. Add Recommendation Review And Explicit Acceptance

- Add `apps/app/features/budgeting/api.ts` and focused types/helpers under `apps/app/features/budgeting/`; post the form's selected allocation targets and centavo values to the Odin API using the current access token. Keep API transport, pending/error state, and recommendation-to-`CreateBudgetInput` mapping out of `BudgetingScreen.tsx` so the screen remains form composition.
- Extend `apps/app/features/budgeting/BudgetingScreen.tsx` with a `Generate recommendation` action enabled only after the existing form and required debt/savings totals are valid. Present the returned category allocations, available category funds, and the preserved debt and savings reservations for review; let the user modify the recommended category amounts before saving, and invalidate the recommendation when any period, total, envelope, or target category input changes.
- Require an explicit `Apply recommendation` action that fills the existing form and then leaves saving to the existing `Save draft offline` flow. Never save or sync from generation or application alone, preserve manually entered values when generation fails or is cancelled, and show the requirement-defined generating, unavailable, error, stale, ready, accepted, and cancelled states/messages.

### 4. Cover Boundaries And Verify End To End

- Add `apps/api/src/__tests__/services/budgetRecommendationService.test.ts` and `apps/api/src/__tests__/routes/budget-recommendations.test.ts`; cover request parsing, authenticated user-ID injection, category/subcategory ownership failures, cents-to-peso conversion, target-ratio derivation, upstream timeout and `422`, malformed/duplicate/unknown allocation responses, and exact-centavo reconciliation.
- Add `apps/app/features/budgeting/__tests__/` coverage for recommendation request construction, invalidation on form changes, unavailable/error/cancel states, review edits, and explicit application into the existing create/update input. Extend `apps/app/local-db/repositories/__tests__/` only if recommendation application requires a repository helper; retain the current user-scoped draft and sync behavior.
- Run `pnpm --filter api test:unit`, `pnpm --filter api build`, `pnpm --filter app test`, and the app TypeScript/build check defined in `apps/app/package.json`. Manually smoke-test with an authenticated user: create a monthly form with valid category preferences and debt/savings reservations, generate and edit a recommendation, apply it, save it offline, sync it, then change a source amount and verify the recommendation is marked stale rather than silently saved.

## Acceptance Criteria

- The mobile app reaches only the authenticated Odin API; the API alone calls the private ML budget endpoint and injects the authenticated user ID.
- Every category or subcategory sent to ML is validated as accessible to the authenticated user.
- Category optimization uses only money remaining after the explicit debt and savings envelopes, with all monetary persistence in integer centavos.
- A recommendation never overwrites or syncs a budget without the user's explicit apply action followed by the existing save action.
- Recommendation changes are ephemeral; existing manual-draft schema and sync behavior remain compatible.
- The UI clearly distinguishes invalid input, unavailable optimizer, generated recommendation, stale recommendation, cancelled review, and accepted recommendation.
- API and app tests cover ownership, units, validation, upstream failures, exact allocation totals, recommendation invalidation, and explicit acceptance.

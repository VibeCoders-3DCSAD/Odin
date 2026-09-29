# Monthly Financial Plan Execution Plan

## Goal

Replace the fragmented budget draft, savings contribution, and debt repayment
planning workflow with one user-reviewable Financial Plan for the next calendar
month. The plan reserves mandatory debt and savings commitments, uses the
next-month expense forecast to recommend category allocations, persists all
selected categories, and reports infeasibility without silently weakening a
user's Fixed or Minimum requirements.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/features/18-financial-plan-management-module.md`
- Forecast requirements: `docs/requirements-engineering/features/14-forecasting-and-financial-intelligence-module.md`
- Budget requirements: `docs/requirements-engineering/features/06-budgeting-module.md`
- Financial condition contract: `../odin-ml/docs/models/classification-v2.md`
- Forecast service: `../odin-ml/app/services/forecast_service.py`
- Optimizer service: `../odin-ml/app/services/budget_service.py`
- Current Odin adapter: `apps/api/src/services/budgetRecommendationService.ts`
- Current local budget persistence: `apps/app/local-db/repositories/budgets.ts`
- Current debt and savings projections: `apps/app/features/debt-manager/debtRepaymentAllocation.ts` and `apps/app/features/savings-forecast/savingsForecast.ts`
- Current anomaly-report pipeline: `apps/api/src/services/alerts/dailyReportService.ts`

## Non-Goals

- Financial Plans do not support weekly, custom, income-cycle, historical, or
  user-selected planning periods; each plan is for the next calendar month.
- Anomaly/IQR output does not alter expense forecasts, optimizer inputs,
  category rules, or allocations; it remains Financial Report content only.
- Do not auto-accept, auto-save, or overwrite a plan after a recommendation.
- Do not rewrite debt repayment strategies or savings-goal forecasting; those
  modules remain the source of their required monthly commitments.
- Do not delete or mutate existing `budgets` and `budget_allocations` records;
  they remain legacy, readable records while new planning writes use Financial
  Plan entities.

## Execution Order

1. Establish the immutable next-month and allocation-rule contracts.
2. Make the ML forecast and optimizer compose through a typed snapshot.
3. Add persisted, syncable Financial Plan records and input snapshots.
4. Build one API orchestration boundary and replace the fragmented UI flow.
5. Retire new writes to legacy budget drafts after migration coverage passes.

## PR Stacking Strategy

The ML and Odin repositories require separate stacks. Merge the ML contract
stack first; the Odin adapter stack depends on its versioned request/response
contract, while the database, app flow, and migration PRs form a stack in
`odin`.

```text
odin-ml/main
└─ feat/monthly-plan-ml-contract
   └─ feat/monthly-plan-infeasibility

odin/main
└─ feat/financial-plan-schema
   └─ feat/financial-plan-orchestrator
      └─ feat/financial-plan-app
         └─ test/financial-plan-migration
```

Create each branch from its displayed parent and target that parent in the PR.
Do not begin the Odin orchestrator PR until the ML contract PR is merged or its
exact API version is otherwise available in the deployed ML environment.

## Linear Sub-Issue Tracking

Create sub-issues from this plan when ready: ML contract, optimizer
infeasibility, financial-plan storage and sync, API orchestration, mobile flow,
and migration verification.

### 1. Define The Next-Month Plan And Allocation Rules

- Touch `docs/requirements-engineering/features/06-budgeting-module.md`,
  `docs/requirements-engineering/features/18-financial-plan-management-module.md`,
  `docs/models/budget-optimizer.md`, and `../odin-ml/app/schemas/budget.py`.
- Define one `next calendar month` helper contract using the app's canonical
  timezone, and reject any plan request whose period is not exactly that month;
  rename the UX-facing allocation rules to `Fixed`, `Minimum`, and `Flexible`.
- `Fixed` means exact configured amount, `Minimum` means a non-reducible floor,
  and `Flexible` means a zero floor; all user-selected targets persist in a
  plan, while every configured Fixed or Minimum target is included even if the
  user did not select it in the form.
- Establish that a target is either a category or a subcategory, never both.
  When a category has user-selected subcategories, optimise the category total
  and distribute it among those subcategories by their saved weights; do not
  create overlapping parent and child tracking allocations.

### 2. Make Forecast Snapshots Typed And Plan-Compatible

- Touch `../odin-ml/app/schemas/forecast.py`,
  `../odin-ml/app/services/forecast_service.py`,
  `../odin-ml/app/api/forecast.py`, `../odin-ml/app/schemas/budget.py`, and
  `../odin-ml/tests/test_forecast.py`.
- Keep forecasting intentionally next-calendar-month only, but return a typed
  `ExpenseForecastSnapshot` with the forecast month, category points, total,
  model/ruleset version, generated timestamp, and quality state
  (`PERSONALIZED`, `FALLBACK`, `COLD_START`, or `INSUFFICIENT_DATA`); the API
  must make the snapshot month explicit so Odin can reject a mismatched plan.
- Replace `BudgetRequest.forecast: dict | None` with that typed snapshot and
  validate that its point categories match submitted allocation targets and its
  month matches the next-month plan period. Forecast amount is each flexible
  target's initial LP target and raises, but never lowers, a Minimum target;
  Fixed targets remain exact.

### 3. Return Structured Infeasibility From The Optimizer

- Touch `../odin-ml/app/services/budget_service.py`,
  `../odin-ml/app/schemas/budget.py`, `../odin-ml/app/api/budget.py`,
  `../odin-ml/docs/models/budget-optimizer.md`, and
  `../odin-ml/tests/test_budget.py`.
- Remove the documented and implied `REDUCED` relaxation behavior: invalid
  requests continue to return `422`, but a mathematically valid request whose
  Fixed, Minimum, debt, savings, and category constraints cannot fit returns a
  successful structured `INFEASIBLE` recommendation with the required total,
  available funds, shortfall, and affected constraints.
- Validate that Fixed inputs have equal floor and ceiling and allocate their
  configured fixed amount rather than `current_spend`; preserve `current_spend`
  solely for tracking and ensure all returned allocation rows, including zeroed
  Flexible rows, retain their requested IDs.

### 4. Add Financial Plan Storage And Complete Its Sync Contract

- Touch new local migrations and repositories under
  `apps/app/local-db/migrations/` and `apps/app/local-db/repositories/`,
  `apps/app/local-db/types.ts`, `apps/app/local-db/client.ts`,
  `apps/app/local-db/sync/pullConvergence.ts`,
  `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`,
  `apps/api/src/__tests__/services/syncApplyOperation.*.test.ts`, and a forward
  migration under `supabase/migrations/`.
- Add `financial_plans`, plan allocations, debt reservations, savings
  reservations, and immutable input-snapshot data sufficient to display exactly
  which forecast, restrictions, debt requirements, savings requirements, and
  Classification V2 result produced a recommendation; persist centavos only
  and scope every read/write by `user_id`.
- Update the complete sync path together: `SyncableEntity`, local queue payload,
  API validator and routing, RPC allowlist/handler, and pull-table list. Verify
  remote migration state with `supabase migration list --linked` and validate
  it with `supabase db push --dry-run`; do not deploy the migration without
  explicit approval.

### 5. Build The Financial Plan Input Assembler And ML Adapter

- Touch new focused services under `apps/api/src/services/financialPlan/`, a new
  `apps/api/src/routes/financial-plans.ts`, `apps/api/src/app.ts`,
  `apps/api/.env.example`, and API service/route tests beside the existing
  budget-recommendation tests.
- At the authenticated Odin API boundary, derive the sole valid next-month
  period; load user-scoped income, configured Fixed/Minimum taxonomy targets,
  transaction history, forecast snapshot, obligations due in the month,
  required debt payments, required savings contributions, and Classification V2
  inputs. Reserve obligations, debt, and savings exactly once before requesting
  category allocation, and explicitly exclude those reserved scheduled amounts
  from the category forecast totals used by the LP.
- Call the ML forecast and budget endpoints only from the API with server-side
  URLs, HMAC trusted-history headers, explicit timeouts, bounded inputs, and
  safe structured logging. Return a user-facing plan DTO containing the input
  snapshot, recommendation, explanations, and either `RECOMMENDATION_READY` or
  `INFEASIBLE`, rather than leaking ML transport types or raw exceptions.

### 6. Replace Budget Draft Creation With Financial Plan Review

- Touch `apps/app/features/financial-plan/FinancialPlanScreen.tsx`, new
  feature-local financial-plan API, types, hooks, and components under
  `apps/app/features/financial-plan/`, `apps/app/components/MobileShell.tsx`,
  and focused React Native tests.
- Replace the tab shell and embedded `BudgetingScreen` creation workflow with a
  single next-month plan review: show the forecast trust state, required
  reservations, category recommendation, subcategory weighted split, and
  Financial Condition Assessment context. The user can edit Flexible amounts
  and subcategory weights, but cannot reduce Fixed or Minimum values; explicit
  accept/save creates the Financial Plan and source changes mark an unaccepted
  recommendation stale.
- Keep the existing Budget screen as a legacy read-only tracker until the
  migration phase is complete. Savings and Debt detail screens keep their own
  schedules and forecasts, but link back to the corresponding Financial Plan
  reservation rather than offering parallel monthly planning forms.

### 7. Move Anomaly Findings To Financial Reports Only

- Touch `apps/api/src/services/alerts/dailyReportService.ts`,
  `apps/api/src/services/alerts/anomalyConfig.ts`, relevant report presentation
  code under `apps/app/features/`, and their tests.
- Remove or prevent any Financial Plan or forecast input path from consuming
  IQR anomaly output; retain anomaly findings as descriptive Financial Report
  entries with the existing non-judgmental language and insufficient-history
  states. Verify that refreshing or accepting a plan never changes from an
  anomaly result alone.

### 8. Migrate The User Journey And Verify End To End

- Touch legacy-budget navigation and empty-state copy in
  `apps/app/features/budgeting/`, Financial Plan migration helpers/tests, API
  tests, local-repository tests, Maestro flows under `apps/app/maestro/`, and
  update `docs/requirements-engineering/features/` to match the shipped model.
- Existing budgets stay readable and syncable as legacy data; block creation of
  new budget drafts once Financial Plan creation is available, offer a
  non-destructive path to create a next-month Financial Plan from the user's
  current source data, and do not attempt to reinterpret old allocations as
  Fixed/Minimum/Flexible rules.
- Run `pnpm --filter api test`, `pnpm --filter api build`,
  `pnpm --filter app test`, `pytest`, `ruff check .`, `ruff format --check .`,
  and `mypy app`; then run Maestro against the installed app to cover a
  feasible plan, an infeasible plan, offline persisted-plan viewing, and a
  report-only anomaly.

## Acceptance Criteria

- A new Financial Plan can only be generated for the next calendar month.
- Every selected category/subcategory appears in the saved plan, and every
  configured Fixed or Minimum target appears even when it was not manually
  selected.
- Fixed amounts are exact, Minimum amounts cannot be reduced, and Flexible
  allocations can be zero without removing their plan row.
- Expense forecast values are a typed, versioned plan input and affect category
  recommendations without double-counting obligations, debt, or savings.
- Category allocations with selected subcategories distribute deterministically
  by saved subcategory weights and never double-count parent/child spending.
- An infeasible plan is returned with a shortfall and conflicting requirements,
  not as a relaxed allocation or generic transport error.
- Accepted plans persist a complete user-scoped snapshot, sync through the full
  local/API/RPC/pull contract, and become stale when an unaccepted source input
  changes.
- IQR findings appear only in Financial Reports and never adjust forecasts or
  Financial Plan recommendations.
- Existing budget records remain accessible, while all new planning writes use
  the Financial Plan model.

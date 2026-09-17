# Savings Details Forecast Execution Plan

## Goal

Add an offline-first upward balance forecast to each Savings Details view using
the Debt repayment forecast's chart, range controls, legend, and compact detail
table pattern. Goal Savings, Personal Savings, and HYSA forecasts will project
recorded history, scheduled contributions, and interest without creating
transactions or mutating balances; HYSA projections will use only bank rules
that are persisted and demonstrably evaluable, with unknown rules shown as an
explicit estimate limitation rather than guessed eligibility.

## Source Of Truth

- Feature index: `docs/requirements-engineering/features/index-feature-modules.md`.
- Savings requirements: `docs/requirements-engineering/features/08-savings-accounts-module.md`, especially sections 8.3.1, 8.9, 8.10, and 8.13-8.16.
- Debt forecast reference: `apps/app/features/debt-manager/debtForecast.ts`, `NonCreditDebtForecastSection.tsx`, `DebtForecastChart.tsx`, `DebtForecastTable.tsx`, and `debtTrendRange.ts`.
- Current savings detail/data paths: `apps/app/features/savings-goals/SavingsGoalsScreen.tsx`, `apps/app/local-db/repositories/savingsGoals.ts`, `savingsGoalActivities.ts`, `savingsAccountDetails.ts`, `financialFoundations.ts`, and `ledger.ts`.
- Existing contribution cadence contract: `apps/app/features/savings-goals/contributionSchedule.ts`.
- Existing savings sync contract: `apps/app/local-db/sync/pullConvergence.ts`, `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, and `supabase/migrations/20261004000000_add_savings_account_details.sql` through `20261007000000_add_hysa_yield_inputs.sql`.

## Non-Goals

- Do not create, post, backfill, or automatically link a contribution, withdrawal, or interest transaction from a forecast point.
- Do not alter the Savings Envelope, allocation strategy, debt-payoff cash-flow handling, alert generation, or the ML spending forecast.
- Do not forecast Time Deposit withdrawals, early-withdrawal penalties, or a penalty inferred from free text; retain its existing maturity information only.
- Do not treat a manually entered or unavailable bank condition as transaction-verified, and do not promise an earned HYSA promotional or boosted rate when qualification cannot be determined.
- Do not deploy a Supabase migration without explicit approval.

## Execution Order

## PR Stacking Strategy

The forecast UI must sit above a complete, syncable interest contract. Split the
data-contract work from the pure forecast engine and presentation so the HYSA
rules can be reviewed independently and no client sends fields the remote RPC
or pull path cannot preserve.

```text
main
└─ feat/savings-yield-contract
   └─ feat/savings-balance-forecast
      └─ feat/savings-forecast-details-ui
```

```bash
git switch -c feat/savings-yield-contract
git switch -c feat/savings-balance-forecast
git switch -c feat/savings-forecast-details-ui
```

Merge the yield-contract branch first, then the forecast-engine branch, then
the detail UI branch. Keep each branch below 200 changed lines where practical;
if the sync migration alone exceeds that size, keep its local, API, RPC, and
pull changes in one atomic contract PR rather than splitting an unsafe sync
boundary.

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready:
HYSA/interest contract; savings forecast calculation and queries; Savings
Details forecast presentation and QA.

### 1. Make The Interest And HYSA Forecast Contract Complete

- Touch `apps/app/local-db/migrations/060_savings_interest_forecast_contract.ts`, `apps/app/local-db/client.ts`, `apps/app/local-db/repositories/savingsAccountDetails.ts`, `apps/app/features/financial-accounts/HysaAccountFormSheet.tsx`, and a forward `supabase/migrations/*_savings_interest_forecast_contract.sql`; add the same fields to `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, and `apps/app/local-db/sync/pullConvergence.ts`.
- Persist a normalized, typed HYSA rules model instead of the current lossy text summary: explicit higher-rate and balance-rate answers (`yes`, `no`, `unknown`), manual eligibility confirmation, qualification period/custom interval, repeatable typed requirements, rate application (`whole_balance`, `tiered`, `unknown`), ordered non-overlapping tiers with a nullable final upper bound, and optional promotion requirements. Preserve old fields as a one-time migration backfill only where their meaning is unambiguous; old free-text conditions and `null` eligibility remain unknown, never converted to met/not met.
- Add an explicit interest-projection configuration for Goal Savings and Personal Savings, because their current annual rate lacks a calculation basis and credit cadence. The product decision must be captured before implementation: either collect basis/credit frequency from the user or label the forecast unavailable until those terms are known; do not silently invent daily/monthly bank terms.
- Require every new field at the local repository, API payload validation, and private RPC boundaries, preserve `user_id` ownership for the savings account and any transactions used to evaluate conditions, and update all remote pull/local-column allowlists together. Validate the forward migration with `supabase migration list --linked` and `supabase db push --dry-run`, without deployment.

### 2. Define One Centavo-Safe Savings Forecast Engine

- Add `apps/app/features/savings-forecast/savingsForecast.ts` and `apps/app/features/savings-forecast/savingsInterest.ts`, with tests under `apps/app/features/savings-forecast/__tests__/`; reuse schedule advancement from `apps/app/features/savings-goals/contributionSchedule.ts` rather than copying debt or savings calendar logic.
- Model ordered points as `recorded_contribution`, `recorded_withdrawal`, `scheduled_contribution`, `interest_accrual`, `interest_credit`, and `current_balance`, carrying an actual/forecast flag, balance, applied rate, interest amount, and eligibility explanation. Start projection from the authoritative current balance on the Philippine as-of date, round every accrual/credit half-up to centavos, and stop Goal Savings scheduled deposits once the target is reached without fabricating a target-date balance.
- For Goals, use linked savings activities as actual history and only the saved contribution schedule for future deposits. For Personal Savings and HYSA, load posted, owned ledger movements involving the selected account for actual history, but never reconstruct an "actual" interest history that was not recorded; show the current balance anchor and a limitation when prior interest cannot be distinguished from opening/ledger movements.
- Evaluate HYSA in strict precedence: active promotion first, otherwise base rate when requirements are failed, then qualifying tier rate, then boosted rate, then base rate. Apply a qualifying boosted/tier rate only through `maximum_eligible_balance_centavos`, apply base rate above that cap, respect whole-balance versus tiered allocation, and accrue/credit using the selected basis and cadence. When a requirement is unknown or no transaction data can evaluate it, use an explicit manual yes/no confirmation if present and mark the result manually confirmed; otherwise project base rate and expose the unknown condition.

### 3. Add User-Scoped Forecast Input Queries

- Add `apps/app/features/savings-forecast/savingsForecastQueries.ts`; extend `apps/app/local-db/repositories/savingsGoalActivities.ts` only if a bounded history query is missing, and add a focused owned-account movement query to `apps/app/local-db/repositories/ledger.ts` rather than filtering the generic paginated transaction list in memory.
- Query Goal activities in one batch by `userId` and goal ID, and query account movements, account details, and qualification-period transactions with explicit `user_id`, selected account ID, posted-status, and bounded date predicates. Pass plain records to the pure engine so its results cannot depend on SQLite, React state, or auth globals.
- Define the evaluation boundaries precisely: deposits are only posted funds arriving at the account, direct income is only posted income deposited there, transaction counts/spend requirements are only countable when their saved requirement type and period map to available owned ledger data, and requirement types such as Other remain unevaluable. A forecast reloads after any selected account/goal activity, account detail, schedule, or relevant ledger mutation; it never reads another user's records or scans one account per loop.

### 4. Reuse The Debt Forecast Presentation Without Reusing Debt Math

- Add `apps/app/features/savings-forecast/SavingsForecastSection.tsx`, `SavingsForecastTable.tsx`, and a savings-specific adapter around `apps/app/features/debt-manager/DebtForecastChart.tsx` or extract a neutral `BalanceForecastChart.tsx` used by both debt and savings. Update `apps/app/features/savings-goals/SavingsGoalsScreen.tsx` to render the section inside both Goal Savings detail and Personal Savings/HYSA account detail views.
- Match the existing Debt forecast design: month/year/all range chips, solid actual and dashed projected paths, Today marker, long-press chart values, compact expandable details, and narrow-screen-safe layout. Use savings language and an upward color treatment, distinguish recorded balance/contributions from planned deposits and projected credited interest, and show the goal target marker only for Goal Savings.
- Provide explicit states: no complete contribution schedule, no configured interest terms, zero-rate projection, no recorded history, achieved goal, archived account/goal, unknown HYSA qualification, manual HYSA confirmation, inactive/expired promotion, and unavailable projection. The section must explain its inputs in plain language and state that planned deposits and projected interest do not change the real balance.

### 5. Cover Forecast, HYSA, Sync, And UI Behavior

- Add calculation tests in `apps/app/features/savings-forecast/__tests__/savingsForecast.test.ts` and `savingsInterest.test.ts`; cover every contribution cadence, records before/after the as-of date, withdrawals, centavo half-up rounding, contribution and interest events on the same date, goal completion before target, zero-rate accounts, and projections that have no usable schedule.
- Cover HYSA base, boosted, promotion precedence, tiered versus whole-balance rates, maximum eligible balance splitting, daily-ending versus average-daily balance, monthly/quarterly/at-maturity credits, promotion boundaries, failed conditions, transaction-evaluable conditions, manual yes/no fallback, unknown conditions, missing data, custom qualification periods, and non-overlapping/unbounded final tiers. Add repository/API/pull tests for invalid fields, backfilled legacy records, ownership rejection, operation payload allowlists, tombstones, and second-device convergence.
- Add app rendering tests for `SavingsForecastSection` and extend `apps/app/maestro/savings-goals-crud.yaml` or add `apps/app/maestro/savings-details-forecast.yaml` after inspecting installed selectors. Verify a Goal and a HYSA detail show actual versus forecast values, scheduled deposits, interest credits, and the HYSA unknown/manual notice without claiming a boosted rate.
- Run `pnpm --filter app test -- --runInBand`, `pnpm --filter app exec tsc --noEmit`, `pnpm --filter api test`, and `pnpm test`; run the focused Maestro flow on an installed emulator, then repeat the required Supabase migration checks from Phase 1 without deploying.

## Acceptance Criteria

- Goal Savings, Personal Savings, and HYSA detail views show a responsive upward balance forecast using the same interaction and visual structure as Debt forecasts while retaining savings-specific labels and semantics.
- Forecast points show recorded movements separately from planned contribution occurrences and projected interest credit events; forecasts never create transactions or change `current_balance_centavos`.
- Goal forecasts use only the goal's user-owned activities, current balance, target, interest terms, and saved contribution schedule; reaching the target stops future planned deposits and displays the target milestone honestly.
- Personal Savings and HYSA forecasts use only selected-account, user-owned, posted ledger data and their persisted account terms; missing historical interest is never presented as recorded fact.
- HYSA rate selection obeys promotion, eligibility, tier, and eligible-balance-cap precedence, and unknown or unevaluable requirements fall back to the base-rate estimate with a visible explanation unless manually confirmed.
- A manually confirmed HYSA qualification is visibly distinct from transaction-evaluated qualification; old null/free-text data remains unknown until the user supplies structured rules or confirmation.
- Every new interest/HYSA field is validated and synchronized consistently through local SQLite, queue payloads, API validation, the remote RPC, and pull convergence, all scoped by `user_id`.
- Focused model, repository, sync, API, TypeScript, and Maestro verification passes, and no remote migration is deployed without explicit approval.

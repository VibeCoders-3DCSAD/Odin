# Financial Plan Classification Utilization Execution Plan

## Goal

Use a fresh, deterministic Financial Condition Assessment to give evidence-backed
optional-surplus recommendations and explanations in the next Financial Plan,
without changing hard feasibility, category allocations, mandatory commitments,
or an already accepted plan. The accepted plan snapshots the assessment and the
debt settings used at acceptance; later setting changes apply only to the next
plan.

## Source Of Truth

- Financial Plan requirements: `docs/requirements-engineering/features/18-financial-plan-management-module.md`
- Financial condition contract: `../odin-ml/docs/models/classification-v2.md`
- Financial Plan orchestration: `apps/api/src/services/financialPlan/recommendationService.ts`
- Classification API and persistence: `apps/api/src/routes/financial-classification.ts`
- Classification input RPC: `supabase/migrations/20261018000000_replace_pfp_with_financial_classification_v2.sql`
- Debt strategy authority: `apps/app/features/debt-manager/debtRepaymentAllocation.ts`
- Savings allocation authority: `apps/app/features/savings-goals/savingsEnvelopeAllocation.ts`
- Accepted-plan persistence and sync: `apps/app/local-db/repositories/financialPlans.ts` and `supabase/migrations/20261023000000_add_financial_plan_sync.sql`

## Non-Goals

- Do not use classification to determine Financial Plan feasibility or change
  Fixed, Minimum, mandatory debt, credit-card, savings, or obligation amounts.
- Do not use classification to alter category-level allocations or optimizer
  weights for food, transport, utilities, or other expense categories.
- Do not move avalanche/snowball, extra-payment eligibility, debt forecasts, or
  savings-goal allocation calculations into Financial Plan.
- Do not mutate an accepted active plan when a debt strategy or
  `allows_extra_payments` setting changes.
- Do not treat absent, stale, insufficient-data, or insufficient-history
  assessments as favourable financial condition.

## Execution Order

1. Repair the assessment input contract and make current classification results
   complete, fresh, and safely optional for Financial Plan generation.
2. Translate only successful, actionable assessments into a small deterministic
   optional-surplus policy.
3. Delegate debt and savings destination calculations to their existing domain
   modules, then present the recommendation for user acceptance.
4. Snapshot the policy, source assessment, and debt settings with the immutable
   accepted Financial Plan and synchronize the new document shape.
5. Explain classification-derived guidance in the Financial Plan and validate
   every positive, conflicting, and unavailable-data path.

## PR Stacking Strategy

The classification-data contract must land before the Odin recommendation and
storage work. Keep the feature in reviewable vertical slices; the active
worktree already contains unrelated Financial Plan and debt changes, so create
these branches only after selecting a clean base or isolated worktree.

```text
odin-ml/main
└─ feat/classification-plan-inputs

odin/main
└─ feat/financial-plan-classification-contract
   └─ feat/financial-plan-surplus-policy
      └─ feat/financial-plan-classification-ui-sync
```

Merge the ML contract first, then the Odin contract, policy, and UI/sync slices
in that order. Use `gt create` from the displayed parent where Graphite is in
use; otherwise create each named branch non-interactively and target its parent.

## Linear Sub-Issue Tracking

Create sub-issues from this plan when ready; no Linear parent issue was supplied
for this planning session.

### 1. Correct And Version Financial Classification Inputs

- Touch `supabase/migrations/<timestamp>_fix_financial_classification_plan_inputs.sql`, `apps/api/src/routes/financial-classification.ts`, `apps/api/src/lib/mlClient.ts`, `../odin-ml/app/schemas/classification.py`, `../odin-ml/app/services/classification_service.py`, and their route/service tests.
- Replace the RPC's all-expense proxy with the application's explicit essential/basic-living-cost source, use a verified current liquid emergency-fund balance rather than only `starting_amount_centavos`, and supply twelve user-owned credit-card cycle balances when available; preserve `INSUFFICIENT_DATA` and `INSUFFICIENT_HISTORY` when authoritative inputs are absent.
- Version the assessment input/rule contract and persist the full ML response metadata with each assessment so Financial Plan can snapshot evidence without reconstructing it; all queries and RPC inputs remain scoped by `p_user_id`.

### 2. Define Freshness And Optional Assessment Retrieval

- Touch `apps/api/src/services/financialPlan/recommendationService.ts`, add `apps/api/src/services/financialPlan/classificationPolicy.ts`, and add focused service tests beside `apps/api/src/__tests__/services/financialPlan/recommendationService.test.ts`.
- Fetch or create a fresh assessment during recommendation generation, unwrap `output_snapshot` instead of copying the assessment-row envelope, and make failure, stale data, `INSUFFICIENT_DATA`, and `INSUFFICIENT_HISTORY` produce a neutral policy rather than a 503 Financial Plan failure.
- Define stale from the captured input timestamps and relevant source-data updates, not a hard-coded label; the generated plan must state whether classification was applied, unavailable, or ignored as stale.

### 3. Translate Classification Into A Deterministic Surplus Policy

- Implement the policy in `apps/api/src/services/financialPlan/classificationPolicy.ts`, extend `apps/app/features/financial-plan/types.ts`, and update `apps/api/src/services/financialPlan/recommendationService.ts` plus its tests.
- Return a typed `surplusRecommendation` with `unallocatedSurplusCentavos`, an advisory destination, supporting assessment evidence, and a reason code: negative financial margin holds all optional surplus for review; otherwise an inadequate emergency fund recommends a verified emergency goal; otherwise actionable debt signals recommend a verified eligible debt; all other surplus remains user-directed.
- Remove the current unconditional 50/50 `debtSurplusCentavos`/`savingsSurplusCentavos` split and keep all classification-based allocations advisory until the user explicitly accepts them.

### 4. Delegate Optional Destinations To Debt And Savings Domains

- Touch `apps/app/features/debt-manager/debtRepaymentAllocation.ts`, `apps/app/features/debt-manager/DebtManagerOverview.tsx`, `apps/app/features/savings-goals/savingsEnvelopeAllocation.ts`, `apps/app/features/savings-goals/savingsEnvelopeAllocationQueries.ts`, and their existing tests.
- Expose a focused domain-facing result for a supplied optional amount: Debt Management filters to active debts with `allowsExtraPayments`, applies the snapshotted avalanche/snowball strategy, and prioritizes a heavy-revolver card only when an authoritative current revolving balance exists; Savings Goals validates an active emergency-fund goal and returns its remaining eligible contribution capacity.
- A high-DSTI label alone must not produce a debt allocation if no eligible debt can benefit, and transactor/light-revolver results remain explanation-only in this first version.

### 5. Persist The Immutable Policy And Setting Snapshots

- Add paired local and remote forward migrations under `apps/app/local-db/migrations/` and `supabase/migrations/`, then update `apps/app/local-db/repositories/financialPlans.ts`, `apps/app/local-db/sync/pullConvergence.ts`, `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, and the Financial Plan sync RPC migration.
- Store the complete assessment evidence, assessment/rule-set version, policy decision, recommended optional destination, unallocated surplus, debt strategy, and the per-debt `allows_extra_payments` eligibility values in the accepted plan snapshot; validate all referenced user-owned debt, statement, and savings IDs in both local and remote write paths.
- Keep Financial Plans create-only and immutable: changes to strategy or extra-payment eligibility after acceptance update only Debt Management defaults and are used when the next plan is generated, never to rewrite the active plan's recommendations or projections.

### 6. Present Advisory Guidance And Full Plan Evidence

- Touch `apps/app/features/financial-plan/FinancialPlanScreen.tsx`, `apps/app/features/financial-plan/financialPlanPresentation.ts`, `apps/app/features/financial-plan/types.ts`, and their component tests.
- Show the optional surplus amount separately from required reservations, explain the measured signal, threshold, policy decision, and destination impact, and require a deliberate user choice before converting a recommendation into an accepted debt or savings allocation.
- Present unavailable or stale assessment data as unknown with neutral, user-directed surplus; do not present a positive-health claim, a recommendation, or an automatic fallback allocation.

### 7. Verify The Cross-Repository Contract

- Extend `../odin-ml/tests/test_classification.py`, `apps/api/src/__tests__/routes/financial-classification.test.ts`, `apps/api/src/__tests__/services/financialPlan/recommendationService.test.ts`, `apps/app/local-db/repositories/__tests__/financialPlans.test.ts`, `apps/app/local-db/sync/__tests__/pullConvergence.test.ts`, and Financial Plan/Debt Manager/Savings Goal feature tests.
- Cover emergency-fund inadequacy with and without an eligible goal, high DSTI with and without an eligible debt, heavy revolver with and without a current revolving balance, negative margin, stale/unavailable/insufficient assessments, conflicting signals, and strategy or eligibility changes after acceptance; assert that feasibility and category allocations are unchanged by every classification result.
- Run `pnpm --filter api test`, `pnpm --filter app test`, and `pnpm test` in `odin`; run `pytest`, `ruff check .`, `ruff format --check .`, and `mypy app` in `odin-ml`. Before deployment, run `supabase migration list --linked` and `supabase db push --dry-run`; do not deploy remote migrations without explicit approval.

## Acceptance Criteria

- Financial Plan feasibility remains based only on planned amount, available
  balance, mandatory commitments, Fixed amounts, and Minimum floors.
- Classification does not change category allocations or optimizer category
  weights.
- A fresh, valid assessment can produce an advisory optional-surplus
  recommendation with stored evidence and a user-facing explanation.
- Negative financial margin leaves optional surplus unallocated for review.
- An inadequate emergency fund recommends only an eligible verified emergency
  goal, and a debt recommendation targets only an eligible current debt/card.
- Missing, stale, insufficient, or failed assessments leave surplus
  user-directed and never block plan generation.
- Accepted plans snapshot their assessment policy, debt strategy, and
  extra-payment eligibility and remain unchanged while active.
- Strategy and `allows_extra_payments` changes affect only newly generated
  Financial Plans.
- Local storage, sync payload validation, remote RPC validation, and pull
  convergence preserve the classification-policy snapshot for the owning user.
- Odin and Odin-ML test, lint, type-check, and migration dry-run commands pass.

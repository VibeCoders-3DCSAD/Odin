# Financial Plan Category Rules Execution Plan

## Goal

Move configuration of an expense subcategory's Financial Plan rule from the
Categories form into Financial Plan category selection. Minimum and Fixed
values remain reusable subcategory defaults, while every accepted plan keeps
its existing immutable allocation snapshot.

## Source Of Truth

- Financial Plan flow: `apps/app/features/financial-plan/FinancialPlanScreen.tsx`
- Category selection UI: `apps/app/features/financial-plan/PlanCategorySelection.tsx`
- Taxonomy form: `apps/app/features/taxonomy/SubcategoryFormScreen.tsx`
- Subcategory persistence: `apps/app/local-db/repositories/taxonomy.ts`
- Plan persistence: `apps/app/local-db/repositories/financialPlans.ts`
- Recommendation assembly: `apps/api/src/services/financialPlan/recommendationService.ts`
- Sync migration: `supabase/migrations/20261022000000_add_subcategory_budget_defaults.sql`

## Non-Goals

- Do not move `minimum_amount_centavos` or `fixed_amount_centavos` into
  `financial_plans` or `financial_plan_allocations`.
- Do not rewrite accepted plans after a user changes a category's default rule.
- Do not introduce a plan-specific draft-rules table or change the next-month
  plan period contract.
- Do not change the optimizer's Fixed, Minimum, and Flexible semantics.

## Execution Order

1. Define the Financial Plan selector as the sole rule-configuration surface.
2. Persist configuration changes through the existing user-scoped subcategory
   update and sync path.
3. Keep recommendation and accepted-plan snapshots behaviorally unchanged.
4. Cover selector interaction, local persistence, and recommendation behavior.

## PR Stacking Strategy

```text
odin/main
└─ feat/financial-plan-category-rules
```

This is one vertical slice: the UI relocation depends on the existing
subcategory columns and already-complete sync contract, so splitting it would
create an incomplete user journey. Create the branch from `main`, target
`main`, and use `gt create feat/financial-plan-category-rules` or the
equivalent non-interactive Git branch command.

## Linear Sub-Issue Tracking

Create a single implementation issue from this plan when ready; no Linear
issue was supplied for this planning session.

### 1. Relocate Default Rule Configuration Into Financial Plan Selection

- Touch `apps/app/features/financial-plan/PlanCategorySelection.tsx`,
  `apps/app/features/financial-plan/FinancialPlanScreen.tsx`, and add a small
  feature-local rule editor only if the selector cannot stay focused.
- For each expense subcategory, let the user choose Flexible, Minimum, or
  Fixed in the Financial Plan flow; Minimum requires a non-negative peso
  floor, Fixed requires a non-negative peso amount, and choosing Flexible
  clears both saved amounts. Save the rule through `updateSubcategory` with
  `userId` and `deviceId`, refresh the local selector data after success, and
  show an item-scoped pending/error state rather than blocking all categories.
- Preserve selection semantics: Minimum and Fixed rules are automatically
  included and cannot be unchecked; Flexible categories remain opt-in. Treat
  `always_in_budget` as a derived compatibility flag for required rules, not a
  separate user-facing rule, so the selector exposes one unambiguous choice.

### 2. Remove Financial Plan Defaults From Categories

- Touch `apps/app/features/taxonomy/SubcategoryFormScreen.tsx` and the input
  types in `apps/app/local-db/repositories/taxonomy.ts` only as needed to stop
  the form from collecting or overwriting budget-rule fields.
- Keep category identity fields, protection, and descriptions in Categories;
  do not clear existing persisted Minimum or Fixed values when a user edits an
  unrelated category attribute. Existing default values must remain visible
  and editable from Financial Plan on the next open.

### 3. Preserve Current Recommendation And Snapshot Contracts

- Touch `apps/api/src/services/financialPlan/recommendationService.ts` only
  if required to make its automatic-inclusion test explicitly use the selected
  default rule; retain `FIXED` as an exact floor/ceiling and `MINIMUM` as a
  non-reducible floor.
- Keep `apps/app/local-db/repositories/financialPlans.ts`,
  `apps/app/local-db/migrations/066_financial_plans.ts`, and
  `supabase/migrations/20261023000000_add_financial_plan_sync.sql` unchanged:
  they already persist `allocation_rule`, allocated amount, and floor as the
  immutable accepted-plan record. No schema migration is needed because the
  editable defaults already live on `subcategories` and their remote sync
  handler already accepts the three fields.

### 4. Test The Whole Contract

- Touch `apps/app/features/financial-plan/__tests__/PlanCategorySelection.test.tsx`,
  add focused tests beside `FinancialPlanScreen.tsx` if needed, and extend
  `apps/api/src/__tests__/services/syncApplyOperation.subcategoryMinimum.test.ts`
  and recommendation-service coverage.
- Verify a Flexible category is selectable, a Minimum and Fixed category are
  saved through the subcategory update path and locked into the next
  recommendation, invalid peso input is rejected, changing a default does not
  alter an already accepted plan, and sync accepts clearing a rule as well as
  setting one. Run `pnpm --filter app test`, `pnpm --filter api test`, then
  `pnpm test` from `odin/`.

## Acceptance Criteria

- Users configure Flexible, Minimum, and Fixed expense rules from Financial
  Plan category selection, not from the Categories form.
- Rule defaults remain user-scoped values on `subcategories` and sync through
  the existing offline queue and remote RPC.
- Existing defaults survive unrelated category edits and appear in the
  Financial Plan selector.
- Minimum and Fixed categories are automatically included in a new plan and
  cannot be reduced below their configured amount.
- An accepted Financial Plan retains its original allocation rule and amounts
  after later default-rule edits.
- App and API test suites pass.

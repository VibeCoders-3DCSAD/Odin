# Seasonal Spending Preferences Implementation Plan

**Goal:** Collect distinct higher- and lower-expense seasons and use them to explain forecasts and flag disagreements without changing calculated amounts.

**Architecture:** Store `low_expense_seasons` alongside existing onboarding JSON answers. Filter mutually exclusive choices in the app and validate complete merged answers in the API. Carry month-matched `lower_expense` evidence into deterministic and AI explanations; place mismatch notices before optional insights.

**Tech Stack:** React Native, TypeScript, Express, Jest, existing Supabase onboarding JSON storage.

## Constraints

- Preserve existing unsaved workspace changes and existing saving-season answers.
- Higher/lower exclusions apply to the same season key; different seasons can overlap in calendar months.
- `none` is exclusive within each answer, but may be selected for both directions.
- Missing lower-expense answers in previously submitted profiles mean unknown.
- Do not invent adjustment percentages or change ML forecasts, allocations, floors, or reservations.

## Steps

- [x] Add `low_expense_seasons` after `high_expense_seasons` in `apps/app/features/onboarding/types.ts`, reusing the same expense-season options. Test option filtering and back-navigation answer cleanup in `apps/app/features/onboarding/__tests__/seasonalAnswers.test.ts`.
- [x] Wire `availableOnboardingStep(step, answers)` and `withOnboardingAnswer(answers, key, value)` from `apps/app/features/onboarding/helpers/seasonalAnswers.ts` into `OnboardingFlow.tsx`, including the review row.
- [x] Validate the new array and reject high/low overlaps, including PATCH requests whose answers conflict with stored values, in `apps/api/src/routes/onboarding.ts`. Require the answer when submitting an in-progress questionnaire. Test create, patch, and submit routes.
- [x] Extend month-matched evidence with `lower_expense` in `recommendationService.ts`, `explanationService.ts`, and `explanationRequest.ts`. Test missing legacy answers, month filtering, decreases, and overlapping calendar windows.
- [x] Add directional possible reasons and mismatch notices to the explanation pipeline. Test that both deterministic and AI paths show mismatches while retaining calculated amounts.
- [x] Run focused onboarding and financial-plan API tests, frontend answer tests, API build, and whitespace validation. Document the behavior in the onboarding and financial-plan feature specifications.

## Verification

`pnpm --filter api test:unit --runTestsByPath src/__tests__/routes/onboarding.sessions.test.ts src/__tests__/routes/onboarding.submit.test.ts src/__tests__/services/financialPlan/explanationService.test.ts src/__tests__/services/financialPlan/explanationRequest.test.ts src/__tests__/services/financialPlan/recommendationSpending.test.ts`

`pnpm --filter app test --runInBand features/onboarding/__tests__/seasonalAnswers.test.ts`

`pnpm --filter api build`

`git diff --check`

## Validation Results

- 118 targeted API tests passed across onboarding routes and financial-plan services/routes.
- Five frontend questionnaire tests passed.
- API TypeScript build and `git diff --check` passed.
- The app-wide TypeScript check remains blocked by errors outside this change in budgeting/dashboard forecast fixtures, financial-plan presentation/local persistence, savings envelope queries, and existing migration/repository tests. No changed onboarding file reports a type error.
- An integration test verifies that persisted lower-expense onboarding answers reach the plan evidence and produce a mismatch notice while keeping forecast and allocation centavos unchanged.

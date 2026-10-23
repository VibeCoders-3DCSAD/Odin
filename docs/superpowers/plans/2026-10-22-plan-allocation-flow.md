# Plan Allocation Flow Implementation Plan

**Goal:** Let users opt into savings and debt planning, set amounts on the plan page, then request category allocations.

**Architecture:** Keep setup choices and draft amounts local to the financial-plan feature. Reuse the existing commitment budgets and reservation skip request contract. Include scheduled bills in the commitment preview so the draft summary matches the recommendation's deductions.

**Tech Stack:** React Native, TypeScript, Express, Supabase, Jest, React Native Testing Library.

## Constraints

- Use Node.js 24.15.0 and pnpm 10.26.1; add no dependencies.
- Scope all preview reads to the authenticated user.
- Preserve accepted plans, original amounts due, and confirmation for resets.
- Work in the current checkout, preserving unrelated changes; execute inline.
- Do not drive a connected device without a request for on-device testing.

## Tasks

- [x] Add independent opt-in checkboxes to setup and label its action `Continue to Plan`. Preserve one-time category amounts when returning from the draft.
- [x] Add a dedicated draft review component with selected commitment editors, a live summary, a back action, and `Recommend Budget Allocation`. Generate immediately when neither option is selected.
- [x] Extend the authenticated commitment preview with bounded scheduled-payment reads and reuse `scheduledPaymentReservations` to deduct payments already made.
- [x] Require `Update Budget Allocation` after editing a generated commitment; prevent saving until regeneration succeeds and preserve edits on retry.
- [x] Update screen tests for deferred generation, independent choices, invalid and excessive amounts, retries, and required recalculation. Verify saved-plan behavior with the existing financial-plan suite.
- [x] Run frontend financial-plan tests, API preview and route tests, TypeScript checks, and `graphify update .`; inspect the final diff.

## Verification

- Frontend financial-plan suite: 88 tests passed across 10 suites.
- API commitment preview and financial-plan routes: 18 tests passed.
- API TypeScript check passed. Frontend TypeScript check reports existing errors in unchanged forecast, presentation, savings, migration-test, and repository-test files; no changed file reported an error.
- Diff whitespace check passed. The local code graph was refreshed.
- No on-device testing was performed.

## Follow-up: exclusions and running services

- Reproduced excluded savings/debt still receiving surplus guidance in the real API recommendation service; filter those destinations by the inclusion choices.
- Reproduced omitted API preferences enabling both commitment types. Default omissions to excluded and require a reviewed amount for every selected scheduled item.
- Reproduced excluded sections reappearing on saved-plan review. Persist inclusion choices in the input snapshot and honor them when reopening new plans; preserve legacy accepted plans.
- Added regression coverage for all four inclusion combinations, custom amounts reaching the optimizer, incomplete review rejection, excluded surplus destinations, and saved-plan visibility.
- Checked odin-ml directly: its optimizer allocates only the supplied categories. All 29 budget tests pass; no ML source changes were needed.
- Rebuilt the stale compiled API. Started the local API, Metro, and ML service. Verified health responses and that Metro's Android bundle contains both checkboxes, the draft review, and the budget recommendation button.
- On-device interaction remains unverified.

Follow-up verification: 102 frontend/persistence tests, 59 API tests, and 29 ML tests passed. API build passed. Frontend type checking still reports the same errors in unchanged files. An accidentally broad API test run also exposed an unrelated existing financial-classification route test failure (expected 200, got 500); the targeted financial-plan checks pass.

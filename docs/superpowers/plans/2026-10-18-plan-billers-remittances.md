# Financial Plan Billers and Remittances Implementation Plan

> **For agentic workers:** Execute this plan inline, task by task, in the existing isolated worktree.

**Goal:** Display Savings & Debt, Billers and Remittances, then Category Allocations, and prevent scheduled payments from being budgeted twice.

**Architecture:** Keep occurrence reservations in the plan's immutable input snapshot. Deduct full scheduled amounts for the plan month from matching category estimates and requirements, while reserving only unpaid amounts. Persist accepted documents locally and through the existing Financial Plan sync RPC.

**Tech Stack:** TypeScript, Expo/React Native, SQLite, Express, Supabase/PostgreSQL, Jest.

## Global Constraints

- Work in the existing odin-billers worktree; preserve unrelated changes.
- Scope all persisted reads and writes to the authenticated user.
- Use integer centavos and clamp deductions to zero.
- Use full in-period scheduled amounts for category deductions, independently of partial payments.
- Match subcategory allocations first; otherwise roll up to their selected parent category.
- Preserve existing accepted plans without recalculating them from current schedules.
- Use pnpm; do not reset databases or drive a device.

### Task 1: Prevent duplicate category funding

- [x] Add a financialPlan helper mapping scheduled occurrences to selected allocation targets and subtracting their totals from baseline/forecast and Fixed/Minimum requirements.
- [x] Update recommendationService to load payment names and subcategories, preserve gross forecasts for proportional splitting, and send net category estimates to the optimizer exactly once.
- [x] Test parent/subcategory matching, multiple occurrences, partial/fully paid schedules, zero clamps, fallback and ML forecasts, and unchanged unrelated categories.

### Task 2: Preserve accepted scheduled commitments

- [x] Add a local migration for input_snapshot_json and recommendation_json, save both documents atomically, and restore them on reads with a legacy scalar fallback.
- [x] Extend pull normalization to retain both JSON documents.
- [x] Add a PostgreSQL migration extending the existing RPC wrapper to persist both documents once, preserving existing validation, resets, and idempotency.
- [x] Test local save/read, legacy reads, and sync normalization. Replay migrations on a clean disposable database when available.

### Task 3: Display the requested hierarchy

- [x] Render Savings & Debt, Billers and Remittances, then Category Allocations in current and historical plans.
- [x] Display snapshotted biller names, remaining reserved amounts, due dates, and totals without another deduction from available funds.
- [x] Test order, empty state, and reopened accepted commitments; update the Financial Plan requirements.
- [x] Run focused API/app tests and TypeScript checks, then inspect the final diff.

## Validation Results

- API: 57 focused tests passed, including reservation schedules, net baselines,
  forecast multipliers, Fixed requirements, infeasibility, routes, and sync input validation.
- App: 62 focused tests passed, including section order, parent selection history,
  offline reopen, cross-device pull, atomic rollback, reset, and spending/commitment reviews.
- API TypeScript build passed.
- Replayed every PostgreSQL migration in order against a clean disposable database,
  bootstrapped with Supabase auth/storage schemas. The Financial Plan document and
  scheduled-payment SQL contract tests both passed.
- The app TypeScript errors and retired-taxonomy pull test failure also reproduce
  on an unchanged HEAD archive. Logs are in /tmp/odin-plan-validation/.
- The migration has not been applied to the application's existing database.

## Main Integration

- Preserve main's monthly-average fallback, deferred explanations, accepted spending insights, and progressive category rendering.
- Use local migration 083 because main already owns versions 079–081 and existing uncommitted work owns 082.

- Integrated validation: 65 API tests, 71 app tests, and the API build passed.
- Replayed the merged PostgreSQL migration sequence (transactionally for migrations using temporary tables); both Financial Plan and scheduled-payment SQL contract checks passed.

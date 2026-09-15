# Savings Goal Contribution Schedule Execution Plan

## Goal

Extend active Goal Savings accounts with a persisted contribution schedule that
uses the existing shared frequency selector. Calculate each goal's centavo-safe
minimum contribution for its remaining scheduled occurrences, then expose the
user-scoped sum required in a selected budget cycle without creating transactions
or moving money automatically.

## Source Of Truth

- Requirements: `docs/requirements-engineering/feature-modules.md`, sections
  8.2-8.17, including the contribution-schedule and total-minimum requirements.
- Existing goal persistence and progress: `apps/app/local-db/repositories/savingsGoals.ts`,
  `apps/app/local-db/repositories/savingsGoalActivities.ts`, and
  `apps/app/features/savings-goals/savingsGoalModel.ts`.
- Shared scheduling UI: `apps/app/features/recurring-transactions/components/FrequencySelector.tsx`
  and `apps/app/features/recurring-transactions/components/RecurringScheduleFields.tsx`.
- Existing period calculation model: `apps/app/features/debt-manager/requiredDebtTotal.ts`
  and `apps/app/features/debt-manager/debtForecast.ts`.
- Sync contract: `apps/app/local-db/sync/pullConvergence.ts`,
  `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`,
  and `supabase/migrations/20261002000016_add_savings_goal_model.sql`.

## Non-Goals

- Do not auto-create, post, or link contribution transactions from a schedule.
- Do not allocate a Savings Envelope, change Budgeting allocation persistence, or
  implement Avalanche/Snowball surplus allocation in this slice.
- Do not calculate a minimum for Personal Savings, HYSA, or Time Deposit accounts;
  those accounts have no target date and cannot produce a meaningful required
  contribution. The aggregate covers active Goal Savings accounts only.
- Do not silently alter a saved contribution schedule when a target, balance, or
  target date changes.

## Execution Order

## PR Stacking Strategy

Keep the schedule contract and sync migration below the calculation/UI consumer
so every branch uses the same persisted data shape.

```text
main
└─ feat/savings-goal-contribution-schedule
   ├─ feat/savings-goal-minimum-contributions
   └─ feat/savings-goal-contribution-presentation
```

```bash
git switch -c feat/savings-goal-contribution-schedule
```

Merge the schedule contract first, then the calculation and Budgeting consumer,
then the presentation branch. If delivered as one PR, retain this order as
separate commits.

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Define The Shared Goal-Schedule Contract

- Add `apps/app/features/savings-goals/contributionSchedule.ts` with the Goal
  Savings frequency union, ISO-date validation, schedule-field validation, and
  deterministic date advancement. Extract the compatible date-advancement logic
  from `apps/app/features/debt-manager/debtForecast.ts` into this focused shared
  helper so debt and savings schedules cannot drift.
- Model a schedule with a planned contribution amount, frequency, first/next
  contribution date, and only the recurrence details required by its selected
  frequency: interval count, weekday, one or two month days, or custom interval
  days. Reuse `FrequencySelector`/`RecurringScheduleFields` rather than adding a
  savings-specific frequency picker; allow Weekly, Biweekly, Semi-Monthly,
  Monthly, Quarterly, Yearly, and Custom, and make Custom require a positive
  interval in days.
- Define the pure calculator in the same module: validate an inclusive budget
  period, enumerate schedule occurrences through a goal's target date, and use
  ceiling centavo division of the current remaining amount across all remaining
  occurrences. For the requested period, sum each due occurrence's minimum,
  cap it at the goal's remaining amount, and subtract only recorded contribution
  activities inside that period; withdrawals never count as a contribution.

### 2. Persist And Synchronize Schedules

- Add `apps/app/local-db/migrations/056_savings_goal_contribution_schedule.ts`,
  register it in `apps/app/local-db/client.ts`, and extend
  `apps/app/local-db/repositories/savingsGoals.ts`. Add
  `planned_contribution_amount_centavos`, `contribution_frequency`,
  `contribution_interval_count`, `contribution_day_of_month`,
  `contribution_second_day_of_month`, `contribution_day_of_week`,
  `custom_interval_days`, and `next_contribution_date` to local
  `savings_goals`; map them into the public goal type, validate them on
  create/update, and include them in transactional queue payloads.
- Preserve existing persisted `auto_save_amount_centavos` by copying it to the
  new planned-contribution column during migration, defaulting the remaining
  schedule fields to null. Existing goals with no complete schedule remain
  readable but are excluded from minimum-contribution totals until edited and
  given a valid schedule; do not fabricate a cadence from historical activity.
- Add the matching columns, constraints, and migration backfill in
  `supabase/migrations/20261005000000_add_savings_goal_contribution_schedule.sql`.
  Update the active `public.apply_sync_operation` wrapper and its delegated
  savings-goal handler to accept, validate, apply, and user-scope every schedule
  field on create and update; retain idempotency, version conflicts, and delete
  tombstones.
- Extend `SAVINGS_GOAL_FIELDS` and `validateSavingsGoalPayload` in
  `apps/api/src/services/syncApplyOperation.ts`, plus `LOCAL_COLUMNS` in
  `apps/app/local-db/sync/pullConvergence.ts`. Confirm the existing
  `savings_goals` pull-table entries in both app and API remain in place and
  carry the new columns; run `supabase migration list --linked` and
  `supabase db push --dry-run`, but do not deploy the remote migration without
  explicit approval.

### 3. Query Minimums And Integrate The Goal Experience

- Add `apps/app/features/savings-goals/requiredSavingsContributions.ts` and
  `requiredSavingsContributionQueries.ts`. The query accepts `userId`,
  `periodStart`, and `periodEnd`, batch-loads active goals and their activities,
  then passes plain data to the pure calculator; it must not query once per goal.
- Extend `apps/app/features/savings-goals/SavingsGoalForm.tsx` to replace the
  Auto-save amount field with planned contribution amount and the shared schedule
  controls. Require a complete valid schedule for new or edited goals, show
  field-level errors, and describe that saving a schedule does not create a
  transaction.
- Extend `apps/app/features/savings-goals/SavingsGoalsScreen.tsx` to show the
  selected goal's next contribution date, planned amount, per-occurrence minimum,
  and behind/on-track status. Expose a no-schedule state for migrated goals
  rather than showing a misleading zero.
- Add the read-only total to `apps/app/features/budgeting/BudgetingScreen.tsx`
  using its selected inclusive budget period. Show the total as the minimum
  savings requirement and identify a Savings Envelope below that amount as a
  planning shortfall; do not persist a Savings Envelope field in this change.

### 4. Verify Schedule, Sync, And Budget Behavior

- Add focused tests in
  `apps/app/features/savings-goals/__tests__/contributionSchedule.test.ts` and
  `requiredSavingsContributions.test.ts`. Cover every supported frequency,
  custom intervals, invalid dates/configurations, month-end clamping,
  semi-monthly ordering, target-date boundaries, centavo ceiling rounding,
  achieved/archived/unscheduled exclusions, activity shortfalls, and multiple
  goal totals in one inclusive budget range.
- Add repository and migration tests for schedule validation, legacy amount
  backfill, user-scoped reads/writes, queue payloads, no-op updates, and pulled
  schedule columns. Extend
  `apps/api/src/__tests__/services/syncApplyOperation.savingsGoals.test.ts` to
  reject unknown schedule fields, invalid frequencies/dates/amounts, and
  unscoped remote mutations.
- Add Savings Goal form/screen tests for shared selector selection, Custom
  interval validation, schedule persistence, migrated no-schedule messaging, and
  aggregate minimum presentation. Add a Maestro flow under `apps/app/maestro/`
  that creates a scheduled goal, reopens it, records a contribution, and verifies
  the resulting minimum/shortfall display.
- Run `pnpm --filter app test -- --runInBand`, `pnpm --filter app exec tsc --noEmit`,
  `pnpm --filter api test`, and `pnpm test`, plus the focused Maestro flow and
  the Supabase dry-run from Phase 2.

## Acceptance Criteria

- A user can save a Goal Savings contribution amount and schedule through the
  existing shared frequency-selector controls without creating a transaction.
- The schedule supports Weekly, Biweekly, Semi-Monthly, Monthly, Quarterly,
  Yearly, and Custom schedules, rejecting incomplete or invalid recurrence data.
- A goal's minimum contribution is calculated from its current remaining amount
  and all valid scheduled occurrences up to its target date, with centavo-safe
  rounding.
- The app shows one deterministic, user-scoped minimum total for all active,
  fully scheduled Goal Savings accounts in an inclusive budget period.
- Recorded contributions reduce that period's remaining required total;
  withdrawals, inactive goals, achieved goals, and unscheduled migrated goals do
  not inflate or falsely satisfy it.
- Local schema, queue payloads, API validation, remote RPC handling, remote pull,
  and local pull convergence carry exactly the same schedule fields.
- The remote migration is verified with `supabase migration list --linked` and
  `supabase db push --dry-run` but is not deployed without approval.

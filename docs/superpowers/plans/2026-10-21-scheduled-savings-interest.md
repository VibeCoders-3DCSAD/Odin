# Scheduled Savings Interest Implementation Plan

**Goal:** Turn the saved savings options into opt-in scheduled income credits.

**Architecture:** Extend the shared reference validator with a credit schedule. Persist it through the existing SQLite JSON and sync contract. A private Postgres engine computes completed Asia/Manila calendar periods from the owned ledger and posts categorized income; pg_cron runs it every five minutes. A private cursor serializes concurrent runs, remembers zero-value periods and carries fractional centavos.

**Tech stack:** Existing TypeScript/React Native, CommonJS shared package, Supabase Postgres and pg_cron; no new dependencies.

## Constraints

- Preserve existing uncommitted work and keep existing accounts opted out.
- Distinguish unknown interest method from explicit none.
- Require basis, method, rate structure, rate, start date and frequency before enabling.
- Use actual days / 365, calendar boundaries, whole-balance tiers, and an explicit withholding percentage.
- Credit on the first day after the completed period; never compound uncredited accrual.
- Simple interest excludes retained automatic credits. Negative eligible balances earn zero.
- Credit transactions and cursor advance must commit together. Deleted credits stay deleted.
- Do not reset the developer database. Replay migrations on a disposable database.

## Implementation

- [x] Extend `packages/savings-interest/index.js` and `index.d.ts` to validate `method: none` and `schedule: { startsOn, frequency, withholdingTaxBps, tiers }`. Reject unsupported keys, invalid calendar dates, unordered thresholds and incomplete enabled configurations. Keep old normalized shapes unchanged when no schedule exists.
- [x] Extend `SavingsInterestFields.tsx` using a separate `SavingsInterestScheduleFields.tsx` for schedule/tier inputs and plain descriptions. Keep form orchestration in the existing helper; validate the annual rate against an enabled schedule there and at the API/database boundaries.
- [x] Add a migration replacing the SQL JSON validator, enforcing schedule/rate compatibility, creating private progress storage and calculation/posting functions, and registering cron. Reuse existing ledger reconciliation and owned income taxonomy conventions.
- [x] Add shared-validator, form and SQL behavior tests covering daily/ADB, simple/compound, tiers, tax, fractional carry, zero balances, completed periods, retries and user boundaries.
- [x] Run `pnpm --filter app test -- --runInBand` for the focused tests, `pnpm --filter api test:unit -- savingsAccountDetails`, app type checking and API build. Run `pnpm exec supabase db push --local --dry-run`, replay the complete sequence in a disposable database and execute the SQL regression file there. Update graphify and document setup/semantics in the account feature requirements and README.

## Verification results

- All 201 PostgreSQL migrations replayed on a clean disposable Supabase instance. The scheduled-interest, reference-metadata, account-link and unique-goal-name SQL suites passed.
- Passed 36 focused app tests and 16 API validation tests under the pinned Node 24.15.0 runtime. API build passes.
- App-wide TypeScript checking retains existing failures in budgeting/dashboard forecast snapshots, financial-plan presentation, savings allocation and older fixtures; no interest-file diagnostics.
- Updated the local Graphify graph. No device interactions or remote deployment were performed.
- An initial local migration dry run succeeded. A subsequent dry run was rejected by automatic approval review: “Supabase database pushes must be run manually by the user.” The development database migration remains unapplied; the user must run `pnpm exec supabase db push --local` manually.

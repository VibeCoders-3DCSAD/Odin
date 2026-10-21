# Savings Goal Account Link Implementation Plan

**Goal:** Require an owned, active financial account when creating a savings goal, persist the link, and sync it across devices.

**Architecture:** Extend the existing savings goal with `linkedAccountId` / `linked_account_id`. Keep legacy goals readable without a link. Query account choices through a user-scoped, bounded repository query, and revalidate the selected account inside the local write transaction, API validation, and PostgreSQL sync/storage boundary.

**Tech Stack:** React Native, TypeScript, Expo SQLite, Express, Supabase PostgreSQL, Jest.

## Constraints

- Reuse existing dependencies and existing financial account identities.
- Preserve all existing goal and account records.
- Account status must be `active`, with `deleted = 0` locally or `false` remotely.
- Pass `userId` explicitly and scope every account query by it.
- Do not reset the developer's database. Replay migrations in a disposable database.

## Deliverable: Required account link

- [x] Add SQLite migration 84 and register it; whitelist `linked_account_id` in sync pull.
- [x] Extend the goal repository mapping, creation input, insert, update payload, and account validation. Existing unrelated goal updates may preserve a missing or inactive legacy link; selecting or creating a link requires an active account.
- [x] Add a bounded selector using this query:

```sql
SELECT id, name FROM financial_accounts
WHERE user_id = ? AND deleted = 0 AND status = 'active'
ORDER BY name COLLATE NOCASE, id LIMIT 100;
```

- [x] Add a loading/error/empty-aware account selector to the form, require selection on create, preserve the selection on edit, and send `linkedAccountId` on save.
- [x] Extend API create/update validation, checking ownership and active status whenever the link is supplied. Require `linked_account_id` for creation.
- [x] Extend the existing PostgreSQL goal sync function to write the link; validate account ownership and active status in a trigger, while allowing existing null links to remain untouched.
- [x] Test account selection, empty/loading/error states, invalid account rejection, persistence, sync payloads, and compatibility with older goals.

Validation commands:

```bash
pnpm --filter app test --runInBand features/savings-goals/__tests__ local-db/repositories/__tests__/savingsGoals.test.ts
pnpm --filter api test --runInBand src/__tests__/services/syncApplyOperation.savingsGoals.test.ts
pnpm exec supabase db push --local --dry-run
```

Replay the complete SQL migration sequence and the account-link SQL tests in a disposable local database. Run TypeScript checks and report unrelated existing failures separately. Refresh the local Graphify graph after implementation.

## Verification results

- All 199 PostgreSQL migrations replay on a clean disposable Supabase PostgreSQL instance.
- PostgreSQL account-link and unique-name tests pass, including goal lifecycle dispatch.
- Form, selector, and SQLite persistence tests pass; API account ownership validation tests pass.
- API TypeScript check passes. App TypeScript retains existing failures in unrelated files.
- The broader pull-convergence suite retains an existing failure for retired taxonomy rows; the account-link changes only extend the savings-goal column allowlist.
- Older offline goal creates are repaired when the user chooses an account, preserving their queued values and allowing retry.
- Restored savings sync routes that newer dispatcher replacements had bypassed, and corrected the existing goal lifecycle enum assignment exposed by the database tests.

## Follow-up: Optional interest reference

- Keep one optional annual interest rate in the Savings account form.
- Put balance basis, simple/compound method, fixed/tiered structure, and notes in a collapsed Advanced options section, defaulting to unknown.
- Preserve older yield and deposit metadata while simplifying the account form.
- Persist validated interest reference metadata locally and through sync; keep it separate from calculation inputs.
- Replay migrations in a disposable database, test save/reopen and boundary validation, then apply the verified local migration.

### Interest reference verification

- Added the shared `@odin/savings-interest` validation contract for app and API.
- Passed 68 focused app checks (including SQLite save/read/update, legacy preservation, form interactions, and pull normalization) and 15 API checks.
- Replayed all 200 PostgreSQL migrations on a disposable database and passed interest-reference, goal-account-link, and unique-goal-name SQL checks.
- Applied `20261116000006_optional_savings_interest_reference.sql` to the local development database after a dry run; no remote migration or data reset.
- API type checking passes. App type checking still reports the pre-existing budgeting, financial-plan, savings-allocation, and unrelated test-fixture errors.
- Updated requirements and the local Graphify code graph. No device interactions were performed.

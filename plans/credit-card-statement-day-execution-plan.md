# Credit Card Statement Day Execution Plan

## Goal

Replace the Debt Manager's statement-arrival prompt with a local-first statement-recording form for any closed billing cycle awaiting its bank statement. Establish non-overlapping billing-cycle lifecycle rules so overriding the open cycle regenerates one deterministic successor, while prior cycles remain available for statement entry and recorded statements remain authoritative and syncable.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/feature-modules.md`, sections 7.4, 7.6, and 7.6.1 through 7.6.3.
- Existing cycle UI: `apps/app/features/debt-manager/DebtManagerScreen.tsx`.
- Existing local Credit Card schema: `apps/app/local-db/migrations/024_credit_cards.ts` and `apps/app/local-db/migrations/036_optional_credit_card_statements.ts`.
- Existing remote schema and Credit Card RPC: `supabase/migrations/20260902000002_credit_card_vertical_slice.sql` and later Credit Card migrations.
- Existing API sync boundary: `apps/api/src/services/syncApplyOperation.ts` and `apps/api/src/services/syncService.ts`.

## Non-Goals

- No issuer integration, statement attachment upload, OCR, or automatic statement reconciliation.
- No payment recording, repayment strategy, debt-budget, finance-charge forecast, credit-balance, or installment-settlement workflow.
- No editing or deleting a recorded statement in this slice; a bank-provided statement is authoritative after it is saved.

## Execution Order

## PR Stacking Strategy

Keep this as one small vertical slice on the current branch. If split for review, land the schema and sync seam before the repository/form integration.

```text
current branch
├─ statement date persistence and legacy-data correction
├─ local repository and sync/RPC allowlists
├─ Debt Manager statement form
└─ database, API, and UI verification
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Establish A Non-Overlapping Billing-Cycle Lifecycle

- Touch the next files in `supabase/migrations/` and `apps/app/local-db/migrations/`, then register the local migration in `apps/app/local-db/client.ts`. Enforce that live cycles for a user-owned card never overlap, including after a cutoff override; use a partial Postgres range-exclusion constraint or equivalent database guard and the matching transactional SQLite check.
- Treat each cycle as an inclusive period with one of three derived states: open, closed-awaiting-statement, or statement-recorded. Only the open cycle may have its dates overridden; a closed cycle remains selectable for statement entry, and a statement-recorded cycle has immutable dates.
- When an open cycle's cutoff changes, update that cycle and remove or supersede only future automatically generated cycles without transactions, payments, or statements. Generate exactly one successor: `next_start = cutoff + 1 day` and `next_cutoff = next_start + billing_cycle_days - 1 day`; make `billing_cycle_days` required for Credit Card accounts before this behavior is enabled.
- Re-route each affected Credit Card transaction by effective posting date as part of the override transaction. Reject an override if any protected future record cannot be safely re-routed; never leave duplicate `cycle_start_date` rows or an unbounded chain of prior snapshots.

### 2. Make The Statement Schema Match The Requirement

- Touch the next files in `supabase/migrations/` and `apps/app/local-db/migrations/`, then register the local migration in `apps/app/local-db/client.ts`. Add a required `statement_date` to `credit_card_statements`, not a new input column on `credit_card_cycles`; the statement date belongs to the authoritative statement record while the cycle keeps its optional recorded-statement date for display.
- Add database checks for non-negative `statement_balance_centavos`, `minimum_due_centavos`, and `finance_charge_centavos`, minimum due not exceeding balance, and a statement date on or after its user-owned cycle cutoff through a trigger or equivalent cross-table guard. Preserve the existing one-live-statement-per-cycle index and set the cycle's optional `statement_date` from the submitted statement in the same server-side operation.
- Touch `apps/app/local-db/repositories/creditCardCycleDates.ts` and `apps/app/local-db/repositories/creditCardCycles.ts` so current-cycle materialization always writes `statement_date: null`; correct existing inferred dates in both stores only when the cycle has no live statement. Do not derive a replacement date from `credit_card_details.statement_day` or other card defaults.
- Extend the same local and remote cycle guards to reject a date change for a statement-recorded cycle. A closed-awaiting-statement cycle may receive statement details while the successor is open; recording a statement must not alter later cycle dates or transactions.

### 3. Add A Focused Local Statement Repository

- Add `apps/app/local-db/repositories/creditCardStatements.ts` and extend `apps/app/local-db/types.ts` with `credit_card_statements`. The repository should expose user-scoped statement lookup by cycle and an atomic create operation that inserts the statement, updates that cycle's recorded `statement_date`, and enqueues the statement and cycle sync operations together.
- Validate ISO dates and integer centavos at this boundary: the selected cycle must be user-owned, closed, and awaiting a statement; statement date must be on/after the stored cutoff, balance and minimum due must be non-negative, minimum due cannot exceed balance, finance charge is optional/non-negative, and due date is required. Reject a second live statement for the same user-owned cycle rather than overwriting the bank-provided record.
- Do not accept account or cycle IDs from arbitrary UI state without checking the selected cycle belongs to the current user and its Credit Card account. Keep raw amount parsing in the form, then pass validated centavo values into the repository.
- Treat a recorded statement as immutable reconciliation data: later billing-cycle overrides and transaction routing changes must never update, delete, recalculate, or otherwise alter its statement date, balance, minimum due, finance charges, due date, or authoritative flag. A cycle override that would invalidate the statement must be rejected before either the cycle or statement is written.

### 4. Extend The Client, API, And RPC Allowlists

- Touch `apps/app/local-db/types.ts`, `apps/app/local-db/sync/pullConvergence.ts` if its table handling needs an explicit entry, `apps/api/src/services/syncService.ts`, and `apps/api/src/services/syncApplyOperation.ts`. Add `credit_card_statements` to every client/API sync allowlist, API pull table list and user scope branch, and Credit Card RPC selection so statement operations use `apply_credit_card_sync_operation` rather than the generic RPC.
- Define narrow create/update field sets in `syncApplyOperation.ts` for `cycle_id`, `statement_date`, `statement_balance_centavos`, `minimum_due_centavos`, optional `finance_charge_centavos`, `due_date`, and the internally enforced authoritative state. Validate date formats, non-negative integers, minimum-versus-balance ordering, the current user's cycle ownership, and the cycle cutoff relationship before the RPC call.
- Update the deployed Credit Card sync function in a new Supabase migration to require and validate `statement_date`, verify the cycle belongs to `auth.uid()`, enforce statement date against that cycle's cutoff, reject a second live statement, and atomically propagate the recorded statement date to the cycle. Keep RLS and database guards authoritative even when the API validator is bypassed.
- Touch `apps/app/local-db/repositories/ledger.ts` and the existing Credit Card routing helpers only where needed to preserve the transaction routing contract: a user may create a backdated purchase in, or edit a purchase so its effective posting date moves into, a historical cycle that already has a recorded statement. Resolve and update only the transaction-to-cycle relationship atomically; do not block the movement because the cycle is finished and do not mutate its statement details.

### 5. Build The Statement-Day Form With Native Date Pickers

- Touch `apps/app/features/debt-manager/DebtManagerScreen.tsx`; extract a small colocated `CreditCardStatementForm.tsx` only if it keeps the screen focused. Replace the static prompt with an explicit `Add statement` action on every closed-awaiting-statement cycle, including a previous cycle while its successor is open, and display the recorded bank-provided values after successful save.
- Use the installed `@react-native-community/datetimepicker` through pressable date fields for statement date and due date; do not use editable `TextInput` fields for dates. Match the existing app picker behavior on Android and iOS and store selected values as ISO `YYYY-MM-DD` dates.
- Render the required fields and exact placeholders: `Select statement date`, `Enter statement balance`, `Enter minimum amount due`, `Enter finance charges or interest`, and `Select due date`. Show `Some statement details are not valid. Check the highlighted fields and try again.`, `Your statement is being recorded. Please wait before trying again.`, `Your statement was recorded. Review the payment requirement before continuing.`, and `Your statement could not be recorded. Check the details and try again.` in their corresponding states; preserve valid input after failure, clear a field error when corrected, and disable duplicate submission while saving.

### 6. Cover The Cross-Boundary Contract And Verify Column Checks

- Add repository tests under `apps/app/local-db/repositories/__tests__/creditCardStatements.test.ts`, extend `apps/app/features/debt-manager/__tests__/DebtManagerScreen.test.tsx`, and add `apps/api/src/__tests__/services/syncApplyOperation.creditCardStatements.test.ts`. Mock the DateTimePicker using the established Financial Accounts test pattern and assert both date fields open the picker rather than accepting typed dates.
- Add migration-level SQL assertions or an integration test that verifies the remote column exists and is non-null for new statements, required checks reject negative values and an excessive minimum, the statement date cannot precede cutoff, a statement cannot be created for another user's cycle, and only one active statement exists per cycle. Cover the `2026-08-30` through `2026-09-01` override producing exactly `2026-09-02` through `2026-10-01` for a 30-day card, rejection of overlapping cycles, statement entry on the September 01 cycle while its successor is open, and rejection of any date edit after a statement is recorded.
- Run `pnpm --filter app test -- --runInBand`, `pnpm --filter api test:unit`, `pnpm --filter api build`, and `pnpm --filter app exec tsc --noEmit`. Run the repository's Supabase migration/schema validation command if available in the checked-out environment, then perform a Maestro smoke flow only when an emulator or device is available.

## Acceptance Criteria

- Live cycles for a card never overlap or accumulate duplicate snapshots after an override.
- Overriding `2026-08-30` through `2026-09-30` to end on `2026-09-01` produces one 30-day successor from `2026-09-02` through `2026-10-01`.
- A closed billing cycle with no recorded statement shows an actionable statement-arrival prompt and `Add statement` action even while a successor cycle is open.
- The form has statement date, statement balance, minimum amount due, optional finance charges/interest, and due date with the exact requirements placeholders.
- Statement date and due date use native date pickers, not free-text entry.
- A statement cannot save without required values, with a negative monetary amount, with a minimum above its balance, or with a statement date before its cycle cutoff.
- The database stores `statement_date` on the authoritative `credit_card_statements` record and keeps the cycle's optional statement date synchronized only after a bank-provided statement is recorded.
- Existing inferred cycle statement dates without a live statement are cleared; no new statement date is calculated or invented.
- A statement-recorded cycle cannot have its dates edited; the recorded statement is never changed to make an override fit.
- A billing-cycle override re-routes affected transactions atomically or fails without changing cycle, transaction, or statement data.
- A user can add or move a transaction into a historical, finished billing cycle, including one with an authoritative statement; routing changes only the transaction relationship and never changes statement details.
- `credit_card_statements` passes the local sync type, API allowlist, API pull, Credit Card RPC routing, and database RPC validation paths.
- All reads and writes for statements and their cycles are scoped to the authenticated user.
- A successful save persists locally, queues sync atomically, displays the bank-provided values, and prevents replacement by a second live statement for that cycle.
- Focused UI, repository, API, column/check, TypeScript, and build verification pass.

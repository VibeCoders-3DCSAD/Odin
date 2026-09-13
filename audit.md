# Supabase Migration Integrity Audit

**Date:** 2026-09-12

**Scope:** `supabase/migrations/` (109 SQL files, 23,587 lines), with the
current sync call sites in `apps/api/src/services/syncService.ts` inspected to
identify the intended RPC surface.

**Verification note:** `supabase migration list --linked` could not run because
the Supabase CLI is not installed in this workspace. Findings about the final
schema are proven for a clean replay of this migration history. Before applying
the remediation, query the linked database's `pg_proc`, `information_schema`,
and grants to account for any out-of-band changes.

---

## Overall Score

| Category | ERRORs | WARNINGs |
|---|---:|---:|
| Security | 1 | 1 |
| Data Integrity | 3 | 1 |
| Performance | 0 | 1 |
| Code Quality | 1 | 2 |
| Error Handling | 0 | 0 |
| **Total** | **5** | **5** |

---

## CRITICAL - Must Fix Before Further Sync Changes

### 1. Versioned/core RPCs remain directly executable and bypass the canonical invariant paths

**Severity:** ERROR - Security / Data Integrity

**Files:**
`supabase/migrations/20260823000000_harden_debt_sync_conflicts.sql:1-2`,
`supabase/migrations/20260905000005_repair_linked_debt_payment_debit.sql:4-5`,
`supabase/migrations/20260905000006_allow_negative_linked_debt_payment_balances.sql:4-5`,
`supabase/migrations/20260906000001_fix_debt_and_card_payment_sync.sql:1-2,50-51`,
`supabase/migrations/20260910000000_restore_credit_on_purchase_delete.sql:1-2`,
`supabase/migrations/20260924000003_reconcile_account_balances_from_ledger.sql:3-4`,
`supabase/migrations/20260902000006_repair_debt_and_credit_card_operations.sql:104`,
`supabase/migrations/20260902000005_harden_credit_card_sync.sql:106`

Renaming a PostgreSQL function does not remove it and preserves its privileges.
The migration history leaves these internal routines callable in `public`:

| Internal RPC | Why direct execution is unsafe |
|---|---|
| `apply_sync_operation_ledger_core` | Bypasses the outer ledger-balance reconciliation wrapper. |
| `apply_debt_sync_operation_v1` through `v5` | Bypasses newer debt payment, conflict, and sparse-update checks. |
| `apply_debt_sync_operation_hardened` | Bypasses the current wrapper's conflict and convergence logic. |
| `apply_credit_card_sync_operation_v2` and `v3` | Bypasses newer payment/statement/strategy handling. |
| `apply_credit_card_sync_operation_core` | Bypasses the wrapper that applies available-credit effects and related validation. |

Several have explicit `authenticated` grants. Others inherit the grant from the
function renamed into the versioned name. No migration revokes their execution
or drops them. `apps/api/src/services/syncService.ts:91-99` correctly calls
only canonical names, but any authenticated caller that can invoke exposed
`public` RPCs can select an old path.

This is an integrity boundary failure rather than a cross-user data leak:
`SECURITY INVOKER` and `auth.uid()` still constrain most rows to the caller,
but direct old calls can mutate user-owned financial records without their
required derived mutations. For example, calling the generic ledger core can
create a posted transaction without changing the affected account balance.

**Fix:** Add one forward migration that does all of the following atomically:

1. `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on every internal
   `*_core`, `*_hardened`, and versioned routine.
2. Drop obsolete routines that are no longer referenced by the canonical
   wrappers, using exact signatures and `RESTRICT` first.
3. Move the few still-needed implementations to a non-exposed schema such as
   `private`, revoke `USAGE` from API roles, and grant only the owning wrapper.
4. Explicitly revoke `PUBLIC` before granting the three canonical RPCs only to
   `authenticated`.
5. Add a database test that asserts the allowed RPC names and grants from
   `pg_proc` / `information_schema.routine_privileges`.

---

### 2. Transaction edits and deletes leave `financial_accounts.current_balance_centavos` stale

**Severity:** ERROR - Data Integrity

**File:** `supabase/migrations/20260924000003_reconcile_account_balances_from_ledger.sql:29-57`

The final `apply_sync_operation` wrapper changes account balances only when:

```sql
p_entity = 'transactions' OR p_operation_type = 'create'
```

More precisely, lines 29-31 return before reconciliation unless the operation
is a newly applied `transactions/create`. A normal transaction update may
change amount, type, source account, destination account, status, or deletion
state in the renamed core, but no compensating debit/credit is performed after
the core returns. Deletes are also skipped completely.

The migration calls the posted ledger authoritative (lines 1-2 and 63-78), but
the incrementally maintained account balance diverges as soon as an existing
transaction changes. The one-time repair statement only corrects rows present
when this migration first runs; it cannot repair future edits.

**Fix:** Treat all transaction mutations as one balanced state transition.
Lock the old transaction row, apply the canonical mutation, lock a stable order
of every affected account, then reverse the old posted effect and apply the new
posted effect. Cover create, update, soft delete, restore, status transitions,
amount changes, and source/destination changes in the same RPC transaction.
Alternatively make `current_balance_centavos` a query/view derived from the
ledger and stop persisting it. Add database integration cases for every state
transition and verify `opening_balance + posted ledger delta = current balance`.

---

### 3. Failed manual debt-payment conflicts can permanently consume an operation ID

**Severity:** ERROR - Data Integrity / Error Handling

**File:** `supabase/migrations/20260906000001_fix_debt_and_card_payment_sync.sql:27-45`

The manual-payment path inserts an `applied_operations` row with
`{"status":"pending"}` at lines 27-29 before checking the debt version. If
the version check at lines 37-39 returns `conflict`, it does not delete the
pending row or store a conflict result. A retry with the same operation ID hits
lines 30 and returns `duplicate`; the original operation never becomes applied
or conflict-resolved.

That function is still on the current debt call chain:
`apply_debt_sync_operation` -> `apply_debt_sync_operation_v5` -> earlier
wrappers -> the manual-payment branch. The final wrapper in
`20261001000000_fix_debt_account_status_sync.sql:152-155` does not correct it.

**Fix:** Do all validation and version checks before reserving the idempotency
key, or delete the pending row before every non-applied return. Prefer one
shared operation-reservation helper with a final result state (`applied`,
`conflict`, or `rejected`) so retries return the persisted result rather than a
generic duplicate. Test a version-conflicted manual payment followed by a
same-ID retry and a corrected new-ID retry.

---

## HIGH - Fix Before Broadening Financial Sync

### 4. Credit-card core behavior is source-text patched at migration time

**Severity:** ERROR - Code Quality / Data Integrity

**Files:**
`supabase/migrations/20260909000000_optional_credit_card_statements.sql:18-32`,
`supabase/migrations/20260909000001_repair_credit_card_sync_null_statement.sql:5-17`,
`supabase/migrations/20260912000000_allow_credit_card_account_fields_in_sync.sql:3-23`,
`supabase/migrations/20260923000000_align_installment_lifecycle_and_backfill.sql:56-76`,
`supabase/migrations/20260928000000_credit_card_account_repayment_strategy.sql:34-54`

Five migrations read a deployed function with `pg_get_functiondef`, perform
literal string replacements, then execute the rewritten text. This makes the
effective business logic depend on exact whitespace and prior function output,
not on source-controlled SQL. A replacement that does not match silently
recreates the unchanged function; a match can alter an unintended duplicate
fragment. The `IF function_definition IS NOT NULL` guards also turn a missing
core function into a successful migration with a broken sync contract.

**Fix:** Replace every dynamic definition patch with a complete,
source-controlled `CREATE OR REPLACE FUNCTION private.apply_credit_card...`
definition. Fail the migration if the expected prior function is absent. Keep
one canonical wrapper and one private core at most, then remove the historical
versions after their grants are revoked.

---

### 5. The sync pull path lacks user-scoped cursor indexes for multiple growing tables

**Severity:** WARNING - Performance / Data Integrity risk

**Files:**
`apps/api/src/services/syncService.ts:182-234`,
`supabase/migrations/20260902000002_credit_card_vertical_slice.sql:73-75`,
`supabase/migrations/20260825000000_reconcile_debt_offline_schema.sql:34-36`

Pulls filter by `user_id`, order by `updated_at` plus identity, and use that
tuple as the cursor. The migration indexes for debt and several card tables are
only `(updated_at, id)`; they omit the leading `user_id`. Under normal growth,
Postgres must scan timestamp ranges across all users to serve one user's pull.
The same pattern is missing for several pulled tables.

**Fix:** Create indexes matching the actual read contract, e.g.
`(user_id, updated_at, id)` for `id`-identity tables and
`(user_id, updated_at, account_id)` for `credit_card_details`. Use `EXPLAIN
(ANALYZE, BUFFERS)` on representative per-user pulls before and after. This
also makes the cursor ordering contract explicit.

---

## MEDIUM - Eliminate Drift and Dead Surface Area

### 6. The schema contains orphaned support artifacts and an unused RLS function

**Severity:** WARNING - Code Quality / Security surface

**Files:**
`supabase/migrations/20260616100000_align_help_and_reporting.sql:14-21`,
`supabase/migrations/20260701050651_remote_schema.sql:3-76`

The earlier migration removes the support-ticket tables, but the later remote
schema snapshot creates three `odin_support_ticket_*` enum types and four
storage policies for `support-ticket-attachments`. No matching support tables,
bucket migration, application references, or `CREATE EVENT TRIGGER` for
`public.rls_auto_enable()` exists in the repository. The function is therefore
an orphaned `SECURITY DEFINER` routine, and the support enums/policies are
dead schema surface.

**Fix:** Confirm no production data/bucket uses these objects, then add a
forward cleanup migration to drop the unused policies, support enum types, and
`rls_auto_enable()` with exact dependency checks. Do not edit historical
migrations already applied.

---

### 7. The baseline is a 4,558-line speculative schema rather than an executable current-state boundary

**Severity:** WARNING - Code Quality / Data Integrity risk

**File:** `supabase/migrations/20260616064145_priority_modules_v3.sql:555-4558`

The baseline creates a very broad set of future-facing tables, RLS policies,
and composite ownership foreign keys in one migration. It includes 444 DDL
declarations across forecasting, recommendations, reports, hardship plans,
and alerts. Several of those modules have no usage outside the baseline and
the one enum-conversion reference in
`20260925000000_submit_onboarding_questionnaire_classifier.sql:30`.

This is not inherently invalid, but it is schema bloat: unimplemented domains
receive permanent tables, policies, indexes, and migration compatibility cost.
It makes current ownership, syncability, and delete semantics harder for both
people and agents to establish. It also obscures which tables are production
contracts versus deferred ideas.

**Fix:** Establish a clean baseline process:

1. Inventory every current table, function, trigger, policy, and enum from the
   linked database.
2. Classify each as active, retained historical data, or unused.
3. Remove only confirmed-unused objects through forward migrations.
4. Archive/squash historical migrations only after all environments are at the
   same version; do not rewrite deployed migration history.
5. Add schema modules by delivered vertical slice, with its RLS, indexes,
   RPCs, and tests, instead of precreating future domains.

---

### 8. `NOT VALID` debt invariant is never validated

**Severity:** WARNING - Data Integrity

**File:** `supabase/migrations/20260902000001_finalize_debt_sync_invariants.sql:1-6`

`debt_accounts_paid_off_balance_chk` is added `NOT VALID`. New writes are
checked, but historical rows with `status = 'paid_off'` and a nonzero balance
remain accepted indefinitely unless a later migration validates the constraint.
No `VALIDATE CONSTRAINT` follows in the history.

**Fix:** First repair or explicitly resolve violating legacy rows, then execute
`ALTER TABLE debt_accounts VALIDATE CONSTRAINT debt_accounts_paid_off_balance_chk`
in a forward migration. Include a preflight query that fails with the affected
record IDs rather than silently accepting a partial invariant.

---

### 9. Migration tests are mixed into the deploy directory

**Severity:** WARNING - Code Quality

**File:** `supabase/migrations/test_recurring_engine.sql`

`test_recurring_engine.sql` is a test file in the migration directory rather
than a versioned migration or a dedicated SQL test directory. It does not match
the timestamp migration convention, but custom scripts that glob all SQL files
can execute it during deployment or omit it during tests without warning.

**Fix:** Move it to `supabase/tests/` (or the repository's chosen database-test
location) and run it through an explicit test command. Keep the migration
directory limited to timestamped, forward-only DDL/data migrations.

---

## LOW - Follow-up Hardening

### 10. `SECURITY DEFINER` function grants are inconsistent and mostly implicit

**Severity:** WARNING - Security

**Files:** `supabase/migrations/20260708043000_create_onboarding_session.sql:5-34`,
`supabase/migrations/20260701050651_remote_schema.sql:11-40`, and the
`SECURITY DEFINER` functions listed throughout `supabase/migrations/`

Some privileged functions explicitly revoke `PUBLIC`, `anon`, and
`authenticated` before granting only `service_role`; others, including
`create_onboarding_session` and `rls_auto_enable`, have no explicit grant
policy. Relying on default function privileges makes the callable surface
environment-dependent and difficult to audit.

**Fix:** Adopt a function-grant convention: revoke `PUBLIC`, `anon`, and
`authenticated` on every new function; grant only the required role after the
function is created. Use a database test to reject privileged routines with
unexpected grants or an unsafe `search_path`.

---

## Files With Zero Violations

- `supabase/migrations/20260708043000_create_onboarding_session.sql` - uses a
  transaction-scoped advisory lock to enforce a single in-progress session per
  user.
- `supabase/migrations/20260717021000_add_recurring_engine_rpc.sql` - uses
  `FOR UPDATE SKIP LOCKED` and conflict keys for concurrent recurring work.
- `supabase/migrations/20260926000000_add_daily_financial_reports.sql` - keeps
  reporting writes service-role-only with explicit revocation and grants.

## Things That Were Done Correctly

- The canonical sync callers are centralized in
  `apps/api/src/services/syncService.ts:91-99`, rather than letting each API
  route choose an arbitrary RPC.
- The migration history consistently uses `auth.uid()` and user-scoped lookups
  in the financial RPCs, which limits the stale-RPC issue to the caller's own
  records rather than exposing cross-user writes.
- Several critical mutators lock owned rows with `FOR UPDATE`, including debt
  payment/account paths and the recurring engine.
- `applied_operations.operation_id` is a primary key
  (`20260709000000_add_sync_infrastructure.sql:28-37`), providing a necessary
  base for idempotent sync once every terminal result is handled consistently.

## Priority Fix Roadmap

### P0 - Lock down the callable surface

| Issue | Action |
|---|---|
| Stale RPCs | Inventory `pg_proc` and function grants; revoke then drop/move all internal versioned and core routines. |
| Canonical RPCs | Explicitly grant only canonical public RPCs, and test the allowlist in CI. |
| Production state | Install the Supabase CLI and compare linked migration history and live routine definitions before cleanup. |

### P1 - Restore ledger and idempotency correctness

| Issue | Action |
|---|---|
| Account balances | Implement one old-effect/new-effect transaction transition for every transaction mutation. |
| Debt retries | Ensure no conflict/rejection leaves an operation pending; persist terminal results. |
| Invariants | Validate the paid-off constraint after repairing historical rows. |

### P2 - Remove drift mechanisms

| Issue | Action |
|---|---|
| Dynamic SQL patches | Replace `pg_get_functiondef` string rewriting with complete canonical function definitions. |
| Pull indexes | Add user-scoped composite cursor indexes and verify plans. |
| Orphans/bloat | Remove confirmed-unused support artifacts and modularize future schema work. |

---

*Generated on 2026-09-12 against migration history and sync-call analysis.
Heuristic N+1 analysis was included for the database pull round-trip/query
shape; no application-loop N+1 was found within this migration-focused scope.*

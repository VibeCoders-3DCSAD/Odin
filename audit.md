# Debt Standards Audit

**Date:** 2026-08-23
**Scope:** Debt-related current repository code only. Inspection against `AGENTS.md` and `docs/standards/REPOSITORY-STANDARDS.md`.
**Verification constraint:** No tests, builds, typechecks, adb, Maestro, or validation commands were run.

## Overall Result

| Category | High | Medium | Low |
|---|---:|---:|---:|
| Data Integrity | 2 | 3 | 0 |
| Testing | 0 | 1 | 0 |
| **Total** | **2** | **4** | **0** |

## Findings

### 1. Exact payoff fails the server write invariant

**Severity:** HIGH — Data Integrity
**Files:** `supabase/migrations/20260822000000_debt_sync_operations.sql:240-247`; schema established in `supabase/migrations/20260616064145_priority_modules_v3.sql:2066-2069`
**Rules:** `AGENTS.md:64-71`, `AGENTS.md:183-196`; `REPOSITORY-STANDARDS.md:180-210`

The debt-payment RPC changes `debt_accounts.status` to `paid_off` when the payment reaches zero, but does not set `paid_off_at`. The schema requires `paid_off_at IS NOT NULL` for every `paid_off` row. Therefore an exact-payoff payment is rejected by the database constraint and the payment, transaction, account debit, and debt update roll back together. The local path has the same missing timestamp representation: `apps/app/local-db/migrations/018_debt_management.ts:7-17` has no `paid_off_at` column and `apps/app/local-db/repositories/debts.ts:175-178` only changes the status.

**Fix:** Set `paid_off_at = COALESCE(paid_off_at, now())` in the server payment update and add/sync the corresponding local column. Preserve the timestamp in `pullConvergence.ts`.

### 2. Debt creation is not idempotent across operation IDs

**Severity:** HIGH — Data Integrity
**File:** `supabase/migrations/20260822000000_debt_sync_operations.sql:114-147`
**Rules:** `AGENTS.md:193-202`; `REPOSITORY-STANDARDS.md:180-210`

`applied_operations` deduplicates only the `operation_id` (`:114-124`). A repeated debt create with the same `record_id` but a new operation ID reaches the unconditional insert at `:128-147` and fails on the primary key. The queue then records a generic failure rather than converging to the existing debt. This is possible whenever a local create is duplicated or reconstructed with a new operation ID; `enqueueOperation` always generates a fresh ID at `apps/app/local-db/helpers.ts:19-44`.

**Fix:** Before inserting, resolve an existing `debt_accounts` row by `id` and authenticated `user_id`; return `duplicate` only when the existing create is equivalent, otherwise return a deterministic conflict/rejection with metadata. Keep the operation-id check as the replay guard.

### 3. `paid_off` can be written while the debt still has a positive balance

**Severity:** MEDIUM — Data Integrity
**Files:** `apps/app/local-db/repositories/debts.ts:114-120`; `apps/api/src/services/syncApplyOperation.ts:250-255`; `supabase/migrations/20260822000000_debt_sync_operations.sql:161-180`
**Rules:** `AGENTS.md:64-71`, `AGENTS.md:183-196`; `REPOSITORY-STANDARDS.md:180-210`

The status mutation accepts `paid_off` independently of the balance. The local repository can mark a debt with a positive balance as paid off, and the server validation permits the same status update without checking the resulting balance. The payment path derives payoff from a zero balance, but the direct status action does not enforce that invariant.

**Fix:** Reject `paid_off` unless the effective `current_balance_centavos` is zero, or make payoff a dedicated balance-reducing operation. Add the same invariant at the local boundary and database constraint where practical.

### 4. Archived status writes do not maintain `archived_at`

**Severity:** MEDIUM — Data Integrity
**Files:** `apps/app/local-db/repositories/debts.ts:114-120`; `supabase/migrations/20260822000000_debt_sync_operations.sql:161-180`; local schema `apps/app/local-db/migrations/018_debt_management.ts:7-17`
**Rules:** `AGENTS.md:64-71`, `AGENTS.md:183-196`; `REPOSITORY-STANDARDS.md:180-210`

The server schema has `archived_at`, but status updates only write `status`; the local schema does not contain the timestamp at all. Archiving and restoring therefore lose the archive event and cannot converge the timestamp across devices. The current server payment guard correctly rejects payments against non-active debts at `20260822000000_debt_sync_operations.sql:183-187`, but that does not repair the archived-state write itself.

**Fix:** Add `archived_at` to the local debt schema and sync columns. Set it when transitioning to `archived`, clear it when restoring to `active`, and preserve it on pulls. Add a database invariant if archived rows must always carry the timestamp.

### 5. Strategy updates still bypass optimistic version conflict handling

**Severity:** MEDIUM — Data Integrity
**Files:** `apps/app/local-db/repositories/debts.ts:141-142`; `supabase/migrations/20260822000000_debt_sync_operations.sql:282-285`; conflict wrapper `supabase/migrations/20260823000000_harden_debt_sync_conflicts.sql:21-45`
**Rules:** `AGENTS.md:55-60`, `AGENTS.md:183-196`, `AGENTS.md:220`; `REPOSITORY-STANDARDS.md:180-210`

Priority version handling was added, but strategy updates still enqueue `baseVersion: null` locally and the server uses an unconditional upsert. Concurrent devices can silently overwrite each other. The hardening wrapper checks only `user_debt_priorities`, not `debt_strategy_preferences`.

**Fix:** Read the local strategy version, enqueue it as `baseVersion`, lock/read the server row, return `conflict` with `current_version` and `conflicted_fields: ['strategy']` on mismatch, and update only after the check.

### 6. Debt-specific test coverage still misses the failure paths

**Severity:** MEDIUM — Testing / Data Integrity
**Files:** Existing coverage in `apps/api/src/__tests__/integration/debtSync.integration.test.ts:64-133`, `apps/api/src/__tests__/services/syncApplyOperation.test.ts:177-240`, and `apps/app/local-db/repositories/__tests__/debts.test.ts:90-152`
**Rules:** `AGENTS.md:209-216`, `AGENTS.md:218-220`; `REPOSITORY-STANDARDS.md:555-619`

The current tests cover payment replay, insufficient source balance, an already-created linked transaction, archived-payment rejection, field-mask rejection, component-sum validation, local rollback, and priority bulk insertion. They do not cover the remaining actionable paths: exact payoff and `paid_off_at`, archive timestamp convergence, rejection of manual `paid_off` with a positive balance, debt create replay with a different operation ID, strategy version conflicts, or preservation of conflict metadata through the API and local queue.

**Fix:** Add focused server integration cases and local repository/sync cases for those paths. Keep tests near the existing debt modules.

## Previous Findings Re-check

| Previous finding | Result | Evidence |
|---|---|---|
| Empty `changed_fields` clearing priorities | **Fixed for update boundaries** | `syncApplyOperation.ts:344-345` rejects empty debt update masks; `20260823000000_harden_debt_sync_conflicts.sql:21-24` repeats the server guard. Payment/create operations correctly remain mask-free. |
| Priority conflict/version handling | **Mostly fixed** | `20260823000000_harden_debt_sync_conflicts.sql:26-43` locks, compares versions, validates active debts, and returns conflict metadata. Strategy preferences remain unversioned; see Finding 5. |
| Payment component total validation | **Fixed in inspected server paths** | API validation at `syncApplyOperation.ts:301-309`; RPC validation at `20260823000000_harden_debt_sync_conflicts.sql:47-55`; base RPC also checks each component at `20260822000000_debt_sync_operations.sql:85-90`. |
| Archived/paid-off server writes | **Not fully fixed** | Archived payments are rejected at `20260822000000_debt_sync_operations.sql:183-187`, but exact payoff violates `paid_off_at`; direct `paid_off` status writes do not require zero balance; archive timestamps are not maintained. Findings 1, 3, and 4. |
| Duplicate debt creation guard | **Not fixed** | Debt create remains an unconditional insert at `20260822000000_debt_sync_operations.sql:127-147`; only operation-ID replay is guarded. Finding 2. |
| Conflict metadata | **Partially fixed** | Priority conflicts return `current_version` and `['priorities']` at `20260823000000_harden_debt_sync_conflicts.sql:31-33`, and `syncService.ts:97-117` forwards metadata. Debt-account conflicts return the submitted mask rather than server-derived changed fields at `20260822000000_debt_sync_operations.sql:152-155`; strategy conflicts are absent. |
| Debt-specific test gaps | **Still present** | Covered and uncovered cases are listed in Finding 6. |

## Correct Implementations

- `apps/api/src/services/syncApplyOperation.ts:327-345` enforces the debt entity allowlist, blocks linked debt-payment edits through generic transaction sync, and rejects empty update masks for debt state/preferences.
- `supabase/migrations/20260822000000_debt_sync_operations.sql:69-123` authenticates the RPC, validates device/payload bounds, and prevents cross-user reuse of an operation ID.
- `supabase/migrations/20260822000000_debt_sync_operations.sql:183-239` scopes debt, transaction, account, and subcategory references to the authenticated user and prevents double-debiting linked transactions.
- `apps/app/local-db/repositories/debts.ts:123-129` requires explicit delete confirmation and scopes the tombstone mutation by `user_id` and record ID.
- `apps/app/local-db/repositories/debts.ts:173-179` wraps the local transaction, debt balance update, payment insert, and queue write in one transaction.

## Priority Fix Roadmap

1. Fix exact payoff timestamp handling and add the local timestamp columns/sync mapping.
2. Add idempotent debt creation by `(user_id, record_id)` with equivalent-payload checking.
3. Enforce the `paid_off` balance invariant and maintain archive timestamps.
4. Add optimistic version handling for strategy preferences and improve account conflict metadata.
5. Add the missing debt integration and local sync tests.

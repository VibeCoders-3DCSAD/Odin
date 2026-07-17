# VIB-231 Recurring Transaction Engine Execution Plan

## Goal

Deliver a server-side recurring engine that advances due `recurring_transaction_templates` into `recurring_transaction_occurrences` and posts real `transactions` idempotently, computes `next_occurrence_date` on template create/update, and lets a `financial_obligation` link to a recurring expense template so the same engine drives both scheduled transaction postings and "upcoming obligation" projections. The mobile app already generates occurrences on demand locally; this plan adds the trusted backend engine, shared date math, and the Obligation ↔ Recurring Template UI link.

## Source Of Truth

- Linear: https://linear.app/vibe-coders-odin/issue/VIB-231/build-recurring-transaction-engine-scheduler-occurrence-generator
- Parent offline-first plan: `plans/vib-155-execution-plan.md` (phase 6 introduced recurring templates and occurrences).
- Remote schema: `supabase/migrations/20260616064145_priority_modules_v3.sql:1354-1455` (templates, obligations), `:1457-1525` (transactions), `:1619-1638` (occurrences with `UNIQUE (recurring_template_id, scheduled_date)` and `posted_chk`).
- Obligation due columns: `supabase/migrations/20260716000009_add_obligation_due_fields.sql`, `…10_patch_obligation_due_fields.sql`, `…11_add_obligation_due_month.sql`, `…12_patch_obligation_due_month.sql`.
- Sync allowlist for templates/occurrences/obligations: `supabase/migrations/20260717015111_add_income_sources_and_obligations_to_sync_allowlist.sql`.
- Existing local recurrence math + occurrence generator (manual, client-side): `apps/app/local-db/repositories/recurringTransactions.ts:172-567`.
- Sync service and pull convergence: `apps/api/src/services/syncService.ts:34-45`, `apps/api/src/services/syncApplyOperation.ts:15-25`, `apps/app/local-db/sync/pullConvergence.ts:10-95`.
- Standards: `AGENTS.md` (single-user account scoping, idempotency at backend/storage for payment-like flows, deletion safety), `docs/standards/REPOSITORY-STANDARDS.md`.
- Verification scripts: `pnpm --filter api build`, `pnpm --filter api test`, `pnpm -r test`.

## Non-Goals

- Do not replace the existing sync engine or add a second sync pipeline.
- Do not move the manual client-side `generateNextOccurrence` to the cloud-only; keep it as offline fallback for foreground use.
- Do not add a separate `obligation_occurrences` table; obligations reuse `recurring_transaction_templates` via `financial_obligations.recurring_template_id`.
- Do not implement push reminders, notification dispatch, or scheduled job infra beyond one protected API route plus a SQL function.
- Do not change transaction shape, balance math, or history UI in this work.
- Do not add expected-spending-events or forecast wiring; later ticket.
- Do not add new Node dependencies; reuse `@supabase/supabase-js` and existing Express stack.

## Execution Order

Ship in order: shared date math → engine SQL function → API route + cron hook → `next_occurrence_date` backfill and trigger → obligation link API/repo → obligation link UI.

## PR Stacking Strategy

```text
main
  └─ feat/vib-231-recurring-engine
       ├─ feat/vib-231-next-occurrence-sql-helper
       │    └─ feat/vib-231-engine-rpc
       │         └─ feat/vib-231-engine-api-route
       │              └─ feat/vib-231-next-occurrence-backfill-trigger
       │                   └─ feat/vib-231-obligation-link-backend
       │                        └─ feat/vib-231-obligation-recurring-ui
```

Merge bottom-up into `feat/vib-231-recurring-engine`; that parent merges into `main`. Vanilla git: create each stack branch from the branch above it, PR each branch against its immediate parent, restack after every merge. With Graphite: `gt create feat/vib-231-...` then `gt submit -s`.

## Linear Sub-Issue Tracking

Created under VIB-231. Linear assigned out-of-sequence IDs; order here matches the execution phases:

- VIB-232 — Phase 1: Shared `odin_next_occurrence_date` SQL helper and calendar edge cases.
- VIB-234 — Phase 2: `run_recurring_transaction_engine(p_as_of)` SQL function (idempotent occurrence + transaction posting).
- VIB-233 — Phase 3: Protected API route `POST /api/recurring/run` and cron wiring.
- VIB-235 — Phase 4: Backfill and `BEFORE INSERT/UPDATE` trigger to populate `next_occurrence_date`.
- VIB-236 — Phase 5: Obligation ↔ recurring template link (RPC + repository).
- VIB-237 — Phase 6: Obligation UI to create/link/unlink a recurring expense template.

### 1. Shared Next-Occurrence Date SQL Helper

- Touch `supabase/migrations/<ts>_add_odin_next_occurrence_date.sql`.
- Add a pure SQL function `odin.next_occurrence_date(starts_on date, last_generated date, frequency odin_recurring_frequency, interval_count int, day_of_month int, second_day_of_month int, day_of_week int, ends_on date, as_of date DEFAULT now()) RETURNS date` mirroring the JS rule in `recurringTransactions.ts:172-208`.
- Handle edge cases in SQL: month-end clamp (last day when `day_of_month` overshoots), leap-year Feb 29 fallback rules, `weekly` honoring `day_of_week`, `monthly` honoring both `day_of_month` and `second_day_of_month` (second only when present), and `ends_on` cutoff returning `NULL`.
- Add pgTAP-style asserts (or `DO $$ ... ASSERT ... $$`) inside the migration for: daily +2, monthly day 31 month-end clamp, weekly day_of_week, yearly Feb 29 leap year, ends_on cutoff.

### 2. Engine SQL Function (Occurrence Generator + Poster)

- Touch `supabase/migrations/<ts>_add_recurring_engine_rpc.sql`.
- Add `odin.run_recurring_transaction_engine(p_as_of date DEFAULT now(), p_limit int DEFAULT 200) RETURNS TABLE(user_id uuid, template_id uuid, occurrence_id uuid, transaction_id uuid, scheduled_date date, status text)` SECURITY DEFINER with explicit `SET search_path = odin, public`.
- Scan `recurring_transaction_templates` where `status = 'active'` and `deleted = false` and `next_occurrence_date IS NOT NULL` and `next_occurrence_date <= p_as_of`, ordered by `next_occurrence_date`, capped by `p_limit`, locked `FOR UPDATE SKIP LOCKED`.
- Per template, loop while `next_occurrence_date <= p_as_of`: insert into `recurring_transaction_occurrences` (`status = 'posted'`, `generated_transaction_id` filled) relying on the existing `UNIQUE (recurring_template_id, scheduled_date)` for idempotency (`ON CONFLICT DO NOTHING`); insert into `transactions` with `entry_source = 'recurring'`, `client_mutation_id = 'recurring:' || template_id || ':' || scheduled_date` for poster idempotency (already enforced by `transactions_client_mutation_unique_idx`), same shape constraints as the schema `transactions_shape_chk`; bump `next_occurrence_date = odin.next_occurrence_date(...)` on the template; set `posted_at = now()`.
- Wrap the whole run in one transaction; on template-level error, write an occurrence row with `status = 'failed'` and `failure_reason`, do not abort the engine.
- All writes strictly user-scoped by the row's `user_id`; no cross-user joins.

### 3. Protected API Route And Cron Wiring

- Touch `apps/api/src/routes/recurring.ts`, `apps/api/src/services/recurringService.ts`, `apps/api/src/app.ts`, and `apps/api/src/__tests__/routes/recurring.test.ts`.
- Add `POST /api/recurring/run` accepting optional `{ as_of, limit }`; service calls `supabase.rpc('run_recurring_transaction_engine', { p_as_of, p_limit })` with service-role key.
- Restrict to a service-role key or an `x-cron-secret` header matched against env `RECURRING_CRON_SECRET` (added to `.env.example`, never committed); reject all user-session traffic with `403`.
- Document the cron invocation in `apps/api/README.md` (or nearest docs): Supabase scheduled function hitting this endpoint every hour is the recommended trigger; manual `curl` with the secret for backfills.
- Tests mock `supabase.rpc` to assert correct payload, secret enforcement, and timeout behavior (timeouts already required by standards).

### 4. Next Occurrence Date Backfill And Trigger

- Touch `supabase/migrations/<ts>_populate_next_occurrence_date.sql` and `<ts>_add_next_occurrence_date_trigger.sql`.
- Backfill: `UPDATE recurring_transaction_templates SET next_occurrence_date = odin.next_occurrence_date(starts_on, last_generated_date, frequency, interval_count, day_of_month, second_day_of_month, day_of_week, ends_on)` where `status = 'active'` and `deleted = false`.
- Add `BEFORE INSERT OR UPDATE` trigger `recurring_transaction_templates_next_occurrence_bump` that recomputes `next_occurrence_date` whenever `frequency`, `interval_count`, `day_of_month`, `second_day_of_month`, `day_of_week`, `starts_on`, `ends_on`, or `last_generated_date` change, unless the row is `deleted`.
- Update local app row creation so the inserted row sets `next_occurrence_date` to the helper's expected output (currently `apps/app/local-db/repositories/recurringTransactions.ts:265` hardcodes `next_occurrence_date = starts_on`); instead compute it inline using the existing JS `computeNextOccurrenceDate` so client and server agree.
- Add a unit test in `apps/app/local-db/repositories/__tests__/recurringTransactions.test.ts` covering the JS helper against the same cases the SQL function asserts (daily, monthly end-of-month, weekly day-of-week, yearly leap, ends_on cutoff).

### 5. Obligation ↔ Recurring Template Backend Link

- Touch `supabase/migrations/<ts>_add_obligation_recurring_link_rpc.sql`, `apps/api/src/services/syncApplyOperation.ts` (obligation create/update allowlist already permits `recurring_template_id`, only validates ownership of that template), and `apps/app/local-db/repositories/financialFoundations.ts` + `recurringTransactions.ts`.
- Add `odin.create_recurring_template_from_obligation(p_obligation_id uuid) RETURNS uuid` SECURITY DEFINER that materializes an `expense` recurring template seeded from the obligation (`subcategory_id`, `amount_centavos`, `frequency`, `day_of_month` from `due_day_of_month`, `day_of_week` from `due_day_of_week`, `starts_on` from now) and returns the new template id; updates `financial_obligations.recurring_template_id`.
- Local repo: add `linkObligationToRecurringTemplate(userId, deviceId, obligationId, templateId | null)` and `automateObligation(userId, deviceId, obligationId)` to `financialFoundations.ts`. Either path enqueues the appropriate `financial_obligations` update operation; `automateObligation` first calls `createRecurringTemplate` with `entry_source = 'recurring'` shape, then links.
- Reuse the existing `recurring_template_id` allowlist validation in `syncApplyOperation` (`recurring_template_id must reference an accessible recurring template` already enforced); no new allowlist work needed beyond confirming the field survives obligation updates.

### 6. Obligation ↔ Recurring Template UI

- Touch `apps/app/features/financial-obligations/ObligationDetailScreen.tsx` (new or existing) + a small `AutomateObligationSheet` component under the same feature folder.
- Add an "Automate this obligation" action when the obligation has no `recurring_template_id`: opens a sheet pre-filled with the obligation's amount/subcategory/due-day, lets the user adjust frequency and start date, and calls `automateObligation` from phase 5.
- When the obligation is already linked, show a "Linked recurring" row with the template name, `next_occurrence_date`, and a confirmed "Unlink" action (destructive-confirmation standard); unlink just sets `recurring_template_id = null` via `linkObligationToRecurringTemplate(..., null)`.
- Read the linked template and its next occurrence from the local DB (templates pull via existing sync convergence); do not call Supabase directly from the screen. Per-item pending state for "automate" and "unlink" actions.
- Reuse the existing account/category interfaces; no new icon dependency; layouts usable at 320-450 dp.

## Acceptance Criteria

- After template create or update, `next_occurrence_date` is computed by SQL helper and persistent; backfill leaves no `active` template with `NULL next_occurrence_date` when `starts_on <= today`.
- Calling `run_recurring_transaction_engine(now())` advances each due template exactly once per scheduled date, creates one `recurring_transaction_occurrences` row per scheduled date, and one posted `transactions` row with `entry_source = 'recurring'` and `client_mutation_id = 'recurring:<template>:<date>'`.
- Re-running the engine for the same `as_of` produces no new rows (idempotent on `UNIQUE (recurring_template_id, scheduled_date)` and on `client_mutation_id`).
- Leap-year Feb 29, month-end day 31 clamp, and `ends_on` cutoff all behave consistently in SQL and JS helpers (test parity).
- `POST /api/recurring/run` rejects user session traffic with `403`, accepts only the configured secret or service role, and returns per-template stats.
- A user can create/recurring-automate a `financial_obligation`, link it to a recurring expense template, and the engine's future postings for that template are queryable as that obligation's scheduled events via `financial_obligations.recurring_template_id`.
- A user can unlink an obligation from its recurring template with an explicit confirm step; the template itself is not deleted by unlink.
- Verification passes: `pnpm --filter api build`, `pnpm --filter api test`, `pnpm -r test`, and a manual engine dry-run via `psql` against `local_perforam` confirming idempotency.
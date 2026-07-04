# VIB-93 Backend Plan

## Goal

Implement the backend slice for `VIB-93 - Phase 1b: Consent & Governance`.

Scope only:

- privacy settings read and update
- consent history read and consent decision capture
- data export request creation
- account deletion request, confirmation, and cancellation

Route source: `plans/odin-api-backend-implementation-plan.md:677-875`
Schema source: `supabase/migrations/20260616064145_priority_modules_v3.sql:193-206`
Schema source: `supabase/migrations/20260616064145_priority_modules_v3.sql:575-648`
Design source: `../../designs/hifi design v1.html`

## Hi-Fi Pages To Support

1. `Register - Privacy consent`
   - Record required consent during sign-up or first-run consent flow.
2. `Settings / Privacy`
   - Read privacy settings, consent status, export entry point, and delete-account entry point.
3. `User Profile`
   - Trigger `Export my data` from the profile row.
4. `Account Offboarding - Confirm`
   - Create, confirm, or cancel an account deletion request.
5. `Offboarding - Deletion requested`
   - Return enough request data for the client to show status and scheduled deletion date.

## Routes To Cover

1. `GET /odin/api/privacy/settings`
   Reference: `plans/odin-api-backend-implementation-plan.md:677-698`
2. `PATCH /odin/api/privacy/settings`
   Reference: `plans/odin-api-backend-implementation-plan.md:700-725`
3. `GET /odin/api/consents`
   Reference: `plans/odin-api-backend-implementation-plan.md:727-753`
4. `POST /odin/api/consents`
   Reference: `plans/odin-api-backend-implementation-plan.md:755-780`
5. `POST /odin/api/data-export-requests`
   Reference: `plans/odin-api-backend-implementation-plan.md:782-805`
6. `POST /odin/api/account-deletion-requests`
   Reference: `plans/odin-api-backend-implementation-plan.md:807-830`
7. `POST /odin/api/account-deletion-requests/:id/confirm`
   Reference: `plans/odin-api-backend-implementation-plan.md:832-853`
8. `POST /odin/api/account-deletion-requests/:id/cancel`
   Reference: `plans/odin-api-backend-implementation-plan.md:855-875`

## Tables To Use

1. `user_privacy_settings`
   - Fields: `personalization_enabled`, `model_training_opt_in`, `research_evaluation_opt_in`, `notifications_opt_in`, `data_retention_days`, `updated_at`, `metadata`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:575-587`
2. `user_consents`
   - Fields: `consent_kind`, `status`, `version`, `recorded_at`, `effective_at`, `withdrawn_at`, `source`, `ip_address`, `user_agent`, `metadata`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:589-608`
3. `data_export_requests`
   - Fields: `status`, `requested_at`, `processed_at`, `expires_at`, `export_storage_path`, `failure_reason`, `metadata`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:610-626`
4. `account_deletion_requests`
   - Fields: `status`, `requested_at`, `confirmed_at`, `scheduled_delete_at`, `completed_at`, `cancelled_at`, `reason`, `metadata`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:628-648`

## Route To Table Mapping

### `GET /odin/api/privacy/settings`

- Read the current user's `user_privacy_settings` row.
- Return schema defaults if the row is missing, matching existing `/odin/api/me` behavior.
- Tables: `user_privacy_settings`

### `PATCH /odin/api/privacy/settings`

- Validate only known boolean flags and optional positive `data_retention_days`.
- Upsert by authenticated `user_id` so first-run users do not fail on a missing row.
- Update `updated_at` on every successful write.
- Tables: `user_privacy_settings`

### `GET /odin/api/consents`

- List the current user's consent records newest first.
- Support optional `consent_kind` filter using the enum values only.
- Keep the list bounded.
- Tables: `user_consents`

### `POST /odin/api/consents`

- Validate `consent_kind`, `status`, `version`, and optional `source`.
- Insert an audit row, never overwrite prior consent history.
- Set `withdrawn_at` when `status` is `withdrawn`.
- Capture safe request metadata only: source, IP, user agent.
- Tables: `user_consents`

### `POST /odin/api/data-export-requests`

- Create a user-scoped export request with `status = requested`.
- Store optional request metadata such as `format` and `reason` in `metadata`.
- Do not generate the export file in this ticket.
- Tables: `data_export_requests`

### `POST /odin/api/account-deletion-requests`

- Create a user-scoped deletion request with `status = requested`.
- Reject a second active request if one is already `requested` or `processing`.
- Default `scheduled_delete_at` to 30 days from request time unless a valid future date is provided.
- Tables: `account_deletion_requests`

### `POST /odin/api/account-deletion-requests/:id/confirm`

- Require `payload.confirmation === true`.
- Scope the request by both `id` and authenticated `user_id`.
- Move the request to `processing`, set `confirmed_at`, and keep `scheduled_delete_at`.
- Do not delete user data in this ticket.
- Tables: `account_deletion_requests`

### `POST /odin/api/account-deletion-requests/:id/cancel`

- Scope the request by both `id` and authenticated `user_id`.
- Allow cancellation only before completion.
- Move the request to `cancelled`, set `cancelled_at`, and store optional cancel reason in `metadata`.
- Tables: `account_deletion_requests`

## Files To Add Or Edit

1. `apps/api/src/routes/privacy.ts`
2. `apps/api/src/routes/consents.ts`
3. `apps/api/src/routes/data-export-requests.ts`
4. `apps/api/src/routes/account-deletion-requests.ts`
5. `apps/api/src/app.ts`
6. `apps/api/src/lib/constants.ts`
7. `apps/api/src/__tests__/routes/privacy.test.ts`
8. `apps/api/src/__tests__/routes/consents.test.ts`
9. `apps/api/src/__tests__/routes/data-export-requests.test.ts`
10. `apps/api/src/__tests__/routes/account-deletion-requests.test.ts`

## Implementation Order

1. Add enum constants for valid consent kinds, consent statuses, and request statuses.
2. Add `privacy.ts`, wire it in `app.ts`, and test read/update defaults and validation.
3. Add `consents.ts`, wire it in `app.ts`, and test list/filter/insert/withdrawal behavior.
4. Add `data-export-requests.ts`, wire it in `app.ts`, and test user-scoped request creation.
5. Add `account-deletion-requests.ts`, wire it in `app.ts`, and test request/confirm/cancel plus duplicate active request rejection.
6. Run `pnpm --filter api test` and `pnpm --filter api build`.

## Branching Strategy

Keep each PR under 200 changed lines when practical. Prefer stacked branches from the current ticket branch:

1. `feat/VIB-93-privacy-settings`
   - Base: `feat/VIB-93-phase-1b-consent-governance`
   - Scope: constants, `privacy.ts`, app wiring, privacy route tests only.
2. `feat/VIB-93-consents`
   - Base: `feat/VIB-93-privacy-settings`
   - Scope: `consents.ts`, app wiring, consent route tests only.
3. `feat/VIB-93-data-export-requests`
   - Base: `feat/VIB-93-consents`
   - Scope: `data-export-requests.ts`, app wiring, export request tests only.
4. `feat/VIB-93-account-deletion-requests`
   - Base: `feat/VIB-93-data-export-requests`
   - Scope: `account-deletion-requests.ts`, app wiring, deletion request tests only.

Final parent branch review only needs integration, conflict, test, and smoke checks if each child PR passed review.

## Implementation Notes

- Scope every read and write by authenticated `user_id`.
- Keep responses thin and aligned with the backend catalog.
- Do not add new tables; the needed governance tables already exist in migrations.
- Do not implement export-file generation or physical data deletion here; this ticket records auditable workflow requests only.
- Keep notification preferences separate from this ticket except the existing `notifications_opt_in` privacy flag.

## Done Criteria

- All 8 routes exist and are wired under `/odin/api`.
- Privacy settings can be read and updated for the authenticated user.
- Consent decisions are append-only audit records.
- Data export requests are persisted as auditable records.
- Account deletion can be requested, confirmed, and cancelled without deleting data.
- Route tests cover success, validation failures, auth failure, and user scoping.

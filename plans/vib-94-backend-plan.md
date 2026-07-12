# VIB-94 Backend Plan

## Goal

Implement the backend slice for `VIB-94 - Phase 1c: Onboarding & Profile Assessment`.

Scope only:

- onboarding session start, read, update, and submit
- onboarding response upsert
- questionnaire-backed profile assessment generation
- current profile assignment read
- suggested profile confirmation and rejection
- manual profile selection
- profile reassessment request

Route source: `plans/odin-api-backend-implementation-plan.md:878-1127`
Schema source: `supabase/migrations/20260616064145_priority_modules_v3.sql:717-870`
RLS source: `supabase/migrations/20260616064145_priority_modules_v3.sql:3472-3546`
Dependency branches: VIB-95 identity/auth and VIB-93 consent/governance should already be merged into the parent feature branch.

## Concurrent Worktree Rule

This ticket should be implemented in its own git worktree so another agent can work on a different issue without sharing the same checkout.

Recommended parent feature branch:

```text
feat/VIB-94-onboarding-profile-assessment
```

Recommended worktree naming:

```text
../odin-vib-94
```

The agent should only touch backend files under `odin/apps/api/`, API route tests under `odin/apps/api/src/__tests__/routes/`, and this plan if updates are needed. Avoid frontend, ML, taxonomy, ledger, budget, forecast, savings, debt, and reporting files.

## Routes To Cover

1. `POST /odin/api/onboarding/sessions`
   Reference: `plans/odin-api-backend-implementation-plan.md:880-911`
2. `PATCH /odin/api/onboarding/sessions/:id`
   Reference: `plans/odin-api-backend-implementation-plan.md:913-939`
3. `POST /odin/api/onboarding/sessions/:id/responses`
   Reference: `plans/odin-api-backend-implementation-plan.md:941-966`
4. `POST /odin/api/onboarding/sessions/:id/submit`
   Reference: `plans/odin-api-backend-implementation-plan.md:968-996`
5. `GET /odin/api/onboarding/sessions/current`
   Reference: `plans/odin-api-backend-implementation-plan.md:998-1019`
6. `POST /odin/api/profile/reassess`
   Reference: `plans/odin-api-backend-implementation-plan.md:1021-1044`
7. `GET /odin/api/profile/assignment/current`
   Reference: `plans/odin-api-backend-implementation-plan.md:1046-1074`
8. `POST /odin/api/profile/assignment/confirm`
   Reference: `plans/odin-api-backend-implementation-plan.md:1076-1099`
9. `POST /odin/api/profile/assignment/reject`
   Reference: `plans/odin-api-backend-implementation-plan.md:1101-1111`
10. `POST /odin/api/profile/assignment/select`
    Reference: `plans/odin-api-backend-implementation-plan.md:1113-1127`

## Tables To Use

1. `onboarding_sessions`
   - Fields: `user_id`, `status`, `started_at`, `submitted_at`, `abandoned_at`, `superseded_at`, `current_step_key`, `raw_answers`, `review_snapshot`, `metadata`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:717-737`
2. `onboarding_responses`
   - Fields: `onboarding_session_id`, `question_key`, `answer`, `updated_at`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:740-748`
3. `financial_profile_assessments`
   - Fields: `user_id`, `onboarding_session_id`, `status`, `assessment_method`, `requested_at`, `assessed_at`, `model_kind`, `model_version`, `proposed_profile_label`, `confidence_score`, `income_type`, `obligation_load_bps`, `explanation_summary`, `input_snapshot`, `output_snapshot`, `failure_reason`, `metadata`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:750-783`
4. `financial_profile_explanation_drivers`
   - Fields: `assessment_id`, `driver_key`, `driver_label`, `value_text`, `impact_label`, `explanation`, `sort_order`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:786-798`
5. `financial_profile_assignments`
   - Fields: `user_id`, `assessment_id`, `profile_label`, `is_active`, `confirmation_required`, `effective_from`, `effective_to`, `confirmed_at`, `rejected_at`, `override_reason`, `explanation`, `metadata`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:800-828`
6. `financial_profile_events`
   - Fields: `user_id`, `assessment_id`, `assignment_id`, `action`, `created_at`, `notes`, `payload`
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:831-843`
7. `user_eligibility_profiles`
   - Used only as the completion gate for onboarding submit.
   - Required completeness rule: `date_of_birth`, `is_filipino = true`, `metro_manila_presence`, `metro_manila_locality_code`, and `primary_employment_classification` must be captured before onboarding is treated as complete.
   - Reference: `supabase/migrations/20260616064145_priority_modules_v3.sql:700-714`

## Route To Table Mapping

### `POST /odin/api/onboarding/sessions`

- Create a new `onboarding_sessions` row for the authenticated `user_id`.
- Supersede any existing `in_progress` session for the user before creating the new one.
- Store the accepted onboarding payload inside `raw_answers` and duplicate only route-owned top-level state such as `current_step_key`.
- Tables: `onboarding_sessions`

### `PATCH /odin/api/onboarding/sessions/:id`

- Scope by both `id` and authenticated `user_id`.
- Allow updates only while `status = in_progress`.
- Merge allowed answer fields into `raw_answers` instead of replacing unrelated answers.
- Update `current_step_key` when provided.
- Tables: `onboarding_sessions`

### `POST /odin/api/onboarding/sessions/:id/responses`

- Verify the session belongs to the authenticated user and is still `in_progress`.
- Upsert by `(onboarding_session_id, question_key)`.
- Store `answer` as JSON and refresh `updated_at`.
- Tables: `onboarding_sessions`, `onboarding_responses`

### `GET /odin/api/onboarding/sessions/current`

- Read the newest active session for the authenticated user.
- Prefer `status = in_progress`; if none exists, return the most recent `submitted` session if the UI needs review state.
- Keep response thin: session id, status, current step, timestamps, and raw answer snapshot.
- Tables: `onboarding_sessions`

### `POST /odin/api/onboarding/sessions/:id/submit`

- Require `payload.confirm_data_use === true`.
- Scope by both `id` and authenticated `user_id`.
- Verify eligibility completeness from `user_eligibility_profiles` before marking the session `submitted`.
- Mark the session `submitted`, set `submitted_at`, and save a `review_snapshot` of the inputs used for assessment.
- Generate a deterministic questionnaire assessment in the API for now; do not call `odin-ml` in this ticket.
- Insert one `financial_profile_assessments` row with `status = suggested`.
- Insert explanation driver rows for the fields that determined the label.
- Deactivate the previous active assignment, then insert a suggested `financial_profile_assignments` row with `confirmation_required = true`.
- Insert `financial_profile_events` rows for `assessment_generated` and `change_suggested`.
- Tables: `onboarding_sessions`, `user_eligibility_profiles`, `financial_profile_assessments`, `financial_profile_explanation_drivers`, `financial_profile_assignments`, `financial_profile_events`

### `GET /odin/api/profile/assignment/current`

- Read the active assignment for the authenticated user.
- Include explanation drivers when the assignment has an assessment.
- Return `null` assignment when none exists; do not fabricate a default profile.
- Tables: `financial_profile_assignments`, `financial_profile_assessments`, `financial_profile_explanation_drivers`

### `POST /odin/api/profile/assignment/confirm`

- Require `payload.confirmation === true`.
- Scope `assignment_id` by authenticated `user_id`.
- Allow confirmation only for the active assignment.
- Set `confirmed_at`, clear `confirmation_required`, and record a `confirmed` event.
- Tables: `financial_profile_assignments`, `financial_profile_events`

### `POST /odin/api/profile/assignment/reject`

- Scope `assignment_id` by authenticated `user_id`.
- Allow rejection only for the active assignment.
- Set `rejected_at`, `override_reason`, `is_active = false`, and record a `rejected` event.
- Do not auto-create a replacement assignment in this route.
- Tables: `financial_profile_assignments`, `financial_profile_events`

### `POST /odin/api/profile/assignment/select`

- Validate `profile_label` against the schema enum values: `stable_flexible`, `stable_obligated`, `variable_flexible`, `variable_obligated`.
- Deactivate the current active assignment, if any.
- Insert a new active manual assignment with `confirmation_required = false`, `confirmed_at = now()`, and `assessment_id = null`.
- Record `manual_override` and `activated` events.
- Tables: `financial_profile_assignments`, `financial_profile_events`

### `POST /odin/api/profile/reassess`

- Create a new `financial_profile_assessments` row for the authenticated user with `status = queued` and `assessment_method = standard` unless the request clearly maps to `manual` or `questionnaire`.
- Store `reason` and `use_recent_transactions` in `metadata`.
- Record an `assessment_requested` event.
- Do not run ledger-based reassessment in this ticket because ledger data belongs to later phases.
- Tables: `financial_profile_assessments`, `financial_profile_events`

## Files To Add Or Edit

1. `apps/api/src/routes/onboarding.ts`
2. `apps/api/src/routes/profile.ts`
3. `apps/api/src/app.ts`
4. `apps/api/src/lib/constants.ts`
5. `apps/api/src/__tests__/routes/onboarding.sessions.test.ts`
6. `apps/api/src/__tests__/routes/onboarding.submit.test.ts`
7. `apps/api/src/__tests__/routes/profile.assignment.test.ts`
8. `apps/api/src/__tests__/routes/profile.reassess.test.ts`

If existing VIB-95 or VIB-93 files expose shared auth/test helpers, reuse them instead of creating new helpers.

## Assessment Heuristic

Keep the first classifier intentionally boring and deterministic:

- `income_type = stable` plus obligation load below the threshold => `stable_flexible`
- `income_type = stable` plus obligation load at or above the threshold => `stable_obligated`
- `income_type = variable` plus obligation load below the threshold => `variable_flexible`
- `income_type = variable` plus obligation load at or above the threshold => `variable_obligated`

Use onboarding answers to compute obligation load when both monthly income and fixed obligations are available. If not enough numeric data exists, fall back to income type and dependent/family-support answers with a lower confidence score. Store the inputs and chosen rule in `input_snapshot`, `output_snapshot`, and explanation drivers so the future ML service can replace the heuristic without changing the route contract.

## Implementation Order

1. Add constants for onboarding statuses, profile labels, assessment statuses, profile event actions, and profile assessment methods.
2. Add `onboarding.ts`, wire it in `app.ts`, and cover start/update/current/response routes.
3. Add submit flow and the deterministic assessment helper inside the onboarding route module unless it becomes shared by reassessment.
4. Add `profile.ts`, wire it in `app.ts`, and cover current/confirm/reject/select/reassess routes.
5. Run `pnpm --filter api test` and `pnpm --filter api build`.

## Stacked PR Strategy

Create one parent feature branch, then open one stack branch at a time. After each stack branch is reviewed by Charles and merged into the parent feature branch, update the worktree to the parent branch and create the next stack branch from there.

Parent feature branch:

```text
feat/VIB-94-onboarding-profile-assessment
```

Stack branches:

1. `feat/VIB-94-onboarding-sessions`
   - Base: `feat/VIB-94-onboarding-profile-assessment`
   - Scope: constants, `onboarding.ts`, app wiring, session start/update/current, response upsert, and route tests for those endpoints.
   - Routes: `POST /onboarding/sessions`, `PATCH /onboarding/sessions/:id`, `POST /onboarding/sessions/:id/responses`, `GET /onboarding/sessions/current`.
2. `feat/VIB-94-onboarding-submit-assessment`
   - Base: updated `feat/VIB-94-onboarding-profile-assessment` after PR 1 is merged.
   - Scope: submit route, eligibility completeness gate, deterministic profile assessment, explanation drivers, suggested assignment creation, and submit tests.
   - Routes: `POST /onboarding/sessions/:id/submit`.
3. `feat/VIB-94-profile-assignment-actions`
   - Base: updated `feat/VIB-94-onboarding-profile-assessment` after PR 2 is merged.
   - Scope: current assignment read, confirm, reject, manual select, event records, and assignment route tests.
   - Routes: `GET /profile/assignment/current`, `POST /profile/assignment/confirm`, `POST /profile/assignment/reject`, `POST /profile/assignment/select`.
4. `feat/VIB-94-profile-reassess`
   - Base: updated `feat/VIB-94-onboarding-profile-assessment` after PR 3 is merged.
   - Scope: reassessment request route, queued assessment/event insert, final integration tests, and any route response cleanup.
   - Routes: `POST /profile/reassess`.

Final parent branch review only needs integration, conflict, test, and smoke checks if each child PR passed review.

## Feedback Loop

Repeat this until all four slices are finished:

1. Create or update parent branch `feat/VIB-94-onboarding-profile-assessment`.
2. Create the next stack branch from the current parent branch.
3. Implement only that slice.
4. Run API tests and build.
5. Open PR from stack branch into the parent feature branch.
6. Charles audits/reviews the stack branch exclusively.
7. Merge stack branch into the parent feature branch after review.
8. Update the worktree to the parent feature branch before starting the next stack branch.

## Implementation Notes

- Scope every read and write by authenticated `user_id`; RLS is not the only boundary.
- Validate all route params, request bodies, enum values, and JSON payload shapes before persistence.
- Keep route handlers thin; put only route-local helpers in the route file until reuse exists.
- Do not add new dependencies.
- Do not add new tables or migrations unless implementation discovers a real schema mismatch.
- Do not call `odin-ml` for assessment in this ticket; the route contract should preserve snapshots so ML can replace the heuristic later.
- Use transactions or the Supabase equivalent for submit, confirm, reject, and manual select flows where multiple writes must stay consistent.
- Never leave two active `financial_profile_assignments` for the same user.
- Do not mark onboarding complete when eligibility fields are missing.
- Do not mix this ticket with auth, privacy, consent, export, deletion, taxonomy, ledger, or dashboard work.

## Done Criteria

- All 10 VIB-94 routes exist and are wired under `/odin/api`.
- Onboarding sessions and responses are user-scoped and editable only while in progress.
- Submit is blocked until required eligibility fields are present.
- Submit creates a suggested assessment, explanation drivers, and one active suggested assignment.
- Current assignment read returns the active assignment and its drivers.
- Users can confirm, reject, manually select, and request reassessment.
- Route tests cover success, validation failures, auth failure, user scoping, and the eligibility completion gate.
- `pnpm --filter api test` passes.
- `pnpm --filter api build` passes.

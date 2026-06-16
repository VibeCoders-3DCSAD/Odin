# VIB-95 Backend Plan

## Goal

Implement the backend slice for `VIB-95 - Phase 1a: Identity & Auth`.

Scope only:

- auth session bootstrap
- user profile read and update
- eligibility profile read and update
- push device token registration

Route source: `plans/odin-api-backend-implementation-plan.md:497-639`
Schema source: `schema/draft-schema-priority-modules-v3.sql:592-724`
Schema source: `schema/draft-schema-priority-modules-v3.sql:3055-3073`

## Routes To Cover

1. `POST /odin/api/auth/session`
   Reference: `plans/odin-api-backend-implementation-plan.md:497-530`
2. `POST /odin/api/auth/password-reset`
   Reference: `plans/odin-api-backend-implementation-plan.md:532-550`
3. `POST /odin/api/auth/logout`
   Reference: `plans/odin-api-backend-implementation-plan.md:553-571`
4. `GET /odin/api/me`
   Reference: `plans/odin-api-backend-implementation-plan.md:574-604`
5. `PATCH /odin/api/me`
   Reference: `plans/odin-api-backend-implementation-plan.md:606-618`
6. `GET /odin/api/eligibility-profile`
   Reference: `plans/odin-api-backend-implementation-plan.md:620-623`
7. `PATCH /odin/api/eligibility-profile`
   Reference: `plans/odin-api-backend-implementation-plan.md:624-639`
8. `POST /odin/api/push-device-tokens`
   Reference: `plans/odin-api-backend-implementation-plan.md:3246-3248`

## Tables To Use

1. `profiles`
   Reference: `schema/draft-schema-priority-modules-v3.sql:592-610`
2. `user_privacy_settings`
   Reference: `schema/draft-schema-priority-modules-v3.sql:612-624`
3. `user_eligibility_profiles`
   Reference: `schema/draft-schema-priority-modules-v3.sql:714-752`
4. `onboarding_sessions`
   Reference: `schema/draft-schema-priority-modules-v3.sql:754-776`
5. `push_device_tokens`
   Reference: `schema/draft-schema-priority-modules-v3.sql:3055-3073`

1. `metro_manila_localities`
   Reference: `schema/draft-schema-priority-modules-v3.sql:687-712`
2. `financial_profile_assignments`
   Reference: `schema/draft-schema-priority-modules-v3.sql:839-869`

## Route To Table Mapping

### `POST /odin/api/auth/session`

- Validate Supabase access token.
- Resolve `auth.users.id` to `profiles.user_id`.
- Ensure `profiles` exists.
- Ensure `user_privacy_settings` exists.
- Read onboarding state from `onboarding_sessions`.
- Tables: `profiles`, `user_privacy_settings`, `onboarding_sessions`

### `POST /odin/api/auth/password-reset`

- Use Supabase Auth only.
- Tables: none required

### `POST /odin/api/auth/logout`

- End the current session on the app side.
- Tables: none required

### `GET /odin/api/me`

- Read profile fields and privacy flags.
- Read active financial profile assignment if present.
- Tables: `profiles`, `user_privacy_settings`, `financial_profile_assignments`

### `PATCH /odin/api/me`

- Update `profiles.display_name`, `profiles.metro_manila_city`, and `profiles.updated_at`.
- Do not store `birth_year` or `occupation` yet.
- Mismatch reference: `plans/odin-api-backend-implementation-plan.md:611-616`
- Tables: `profiles`

### `GET /odin/api/eligibility-profile`

- Read the user's eligibility profile.
- Validate locality code against `metro_manila_localities`.
- Tables: `user_eligibility_profiles`, `metro_manila_localities`

### `PATCH /odin/api/eligibility-profile`

- Upsert eligibility profile fields.
- Respect age and completeness constraints.
- Set `eligibility_confirmed_at` only when required fields are complete.
- Tables: `user_eligibility_profiles`, `metro_manila_localities`

### `POST /odin/api/push-device-tokens`

- Insert or upsert a device token per user.
- Use `(user_id, device_token)` uniqueness.
- Tables: `push_device_tokens`

## Required Database Trigger

- Add a trigger on `auth.users` insert.
- Create the matching `profiles` row automatically.
- Also create `user_privacy_settings` with defaults if possible.
- Minimum profile fields: `user_id`, optional `display_name`, schema defaults.
- References: `schema/draft-schema-priority-modules-v3.sql:592-610`
- References: `schema/draft-schema-priority-modules-v3.sql:612-624`

## Implementation Notes

- Scope every read and write by authenticated `user_id`.
- Keep `POST /odin/api/auth/session` idempotent.
- Prefer upsert for `user_eligibility_profiles` and `push_device_tokens`.
- Return thin responses matching the route catalog.
- Do not expand this ticket into consent, privacy CRUD, export, or deletion.

## Done Criteria

- All 8 routes above exist and are wired.
- Profile bootstrap works for a first-time Supabase user.
- `/me` and `/eligibility-profile` are user-scoped.
- Push device token registration is persisted.

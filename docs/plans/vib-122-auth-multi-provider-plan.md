# VIB-122 Auth Multi-Provider Plan

## Goal

Implement `VIB-122 - Add email+password auth alongside Google sign-in`.

Scope only:

- restore email + password registration
- add email + password login
- restore password reset request flow
- add password update flow for reset completion
- keep existing Google sign-in working
- keep shared session bootstrap and logout behavior provider-agnostic

Primary reference: `apps/api/src/routes/auth.ts`
Primary implementation reference commit: `5607a47` (`feat(api): add auth routes (register, session, password-reset, logout)`)
Current-state reference commit: `b3a4a17` (`feat(api): migrate auth to Google sign-in`)
Linear issue: `VIB-122`

## Routes To Cover

1. `POST /odin/api/auth/google`
   Keep existing route behavior and tests intact.
2. `POST /odin/api/auth/register`
   Reintroduce email + password sign-up through Supabase Auth.
3. `POST /odin/api/auth/login`
   Add email + password sign-in through Supabase Auth.
4. `POST /odin/api/auth/password-reset`
   Reintroduce reset-email flow through Supabase Auth.
5. `POST /odin/api/auth/password-update`
   Add authenticated password update flow for reset completion.
6. `POST /odin/api/auth/session`
   Keep token bootstrap shared across Google and email/password sessions.
7. `POST /odin/api/auth/logout`
   Keep provider-agnostic logout behavior.

## Behavior Plan

### `POST /odin/api/auth/google`

- Keep `supabase.auth.signInWithIdToken` with provider `google`.
- Continue bootstrapping the authenticated user through `bootstrapAuthenticatedUser`.
- Do not fork profile or onboarding logic by provider.

### `POST /odin/api/auth/register`

- Accept `email` and `password` from `request.body.payload`.
- Validate both are present before calling Supabase.
- Call `supabase.auth.signUp`.
- Return the created user id and any access or refresh tokens Supabase provides.
- Preserve current onboarding bootstrap expectations:
  if the user is already signed in after registration, bootstrap immediately;
  if email confirmation is required first, rely on `/auth/session` after confirmation.
- Avoid duplicating profile creation logic inside the route when the shared bootstrap helper already handles it.

### `POST /odin/api/auth/login`

- Accept `email` and `password` from `request.body.payload`.
- Validate both are present.
- Call `supabase.auth.signInWithPassword`.
- On success, return access and refresh tokens plus the same bootstrapped payload shape used by Google sign-in.
- On invalid credentials, return `401` without leaking Supabase internals.

### `POST /odin/api/auth/password-reset`

- Accept `email` from `request.body.payload`.
- Validate it is present.
- Call `supabase.auth.resetPasswordForEmail`.
- Return a thin success payload without exposing whether the account exists.
- Keep this route free of profile-table access.

### `POST /odin/api/auth/password-update`

- Require authenticated Supabase context through the reset-session access token.
- Accept the new password from `request.body.payload`.
- Validate it is present.
- Call `request.supabase!.auth.updateUser({ password })` or the equivalent authenticated client flow already used in the repo.
- Return a thin success payload.
- Keep this route separate from login so reset completion stays explicit.

### `POST /odin/api/auth/session`

- Keep bearer-token validation with `supabase.auth.getUser`.
- Keep `bootstrapAuthenticatedUser` as the single place that ensures:
  - `profiles`
  - `user_privacy_settings`
  - latest `onboarding_sessions` status
- Do not split session bootstrap by provider.

### `POST /odin/api/auth/logout`

- Keep `requireAuth` middleware.
- Keep `request.supabase!.auth.signOut()`.
- Ensure tests still prove logout is not tied to Google-only behavior.

## Test Plan

### Restore or Add Route Tests

1. `apps/api/src/__tests__/routes/auth.google.test.ts`
   Confirm current behavior still passes.
2. `apps/api/src/__tests__/routes/auth.register.test.ts`
   Restore and update to match the current shared bootstrap behavior.
3. `apps/api/src/__tests__/routes/auth.login.test.ts`
   Add coverage for success, missing fields, and invalid credentials.
4. `apps/api/src/__tests__/routes/auth.password-reset.test.ts`
   Restore and update the reset flow tests.
5. `apps/api/src/__tests__/routes/auth.password-update.test.ts`
   Add coverage for authenticated reset completion, missing password, and Supabase failure.
6. `apps/api/src/__tests__/routes/auth.session.test.ts`
   Keep existing bootstrap coverage as the shared provider-neutral contract.
7. `apps/api/src/__tests__/routes/auth.logout.test.ts`
   Keep logout coverage intact.

### Shared Assertions

- Auth success payloads should stay structurally consistent across Google and email/password sign-in.
- Error responses should stay thin and not leak raw Supabase messages.
- First-login bootstrap should still create or ensure profile and privacy rows.
- Session bootstrap should remain idempotent.

## Implementation Steps

1. Read the current `apps/api/src/routes/auth.ts` and extract any route-local branching that should stay shared.
2. Use `5607a47` as the source-of-truth reference for restoring `register` and `password-reset` route behavior, but port that logic into the current post-Google route structure instead of reverting the migration wholesale.
3. Add a new `/auth/login` route using the same success payload shape as `/auth/google`.
4. Add a new `/auth/password-update` route for reset completion.
5. Reintroduce or add tests route by route, keeping mocks aligned with the current Supabase client surface.
6. Run the API test suite for auth routes and fix payload or status mismatches.

## Reference Diff Commands

- Inspect the old route implementation:
  `git show 5607a47:apps/api/src/routes/auth.ts`
- Inspect the current route implementation:
  `git show b3a4a17:apps/api/src/routes/auth.ts`
- Compare the migration directly:
  `git diff 5607a47 b3a4a17 -- apps/api/src/routes/auth.ts`
- Inspect the old auth tests:
  `git show 5607a47:apps/api/src/__tests__/routes/auth.register.test.ts`
  `git show 5607a47:apps/api/src/__tests__/routes/auth.password-reset.test.ts`

## Risks To Watch

- Reintroducing `register` and `password-reset` from the old commit verbatim could regress the current shared bootstrap behavior if the route payload shape drifted.
- `password-update` needs the right authenticated Supabase client path; wiring it against the wrong token flow will fail in real reset sessions.
- Login and Google sign-in must return compatible payloads or the app will need provider-specific handling.
- Error handling must not expose raw auth-provider details in API responses.

## Done Criteria

- Google sign-in still works.
- Email + password registration works.
- Email + password login works.
- Password reset request works.
- Password update works for authenticated reset completion.
- `/auth/session` and `/auth/logout` continue to work for either auth provider.
- Auth route tests cover both providers and pass.

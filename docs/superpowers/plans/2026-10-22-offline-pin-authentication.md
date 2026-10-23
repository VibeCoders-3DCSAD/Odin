# Offline PIN Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Resolve these skill names against installed capabilities before execution; do not assume they are installed. Inline implementation is also possible using the repository's available tools and standards.

**Goal:** Keep an enrolled account available offline behind a six-digit PIN, lock PIN entry for one hour after five incorrect attempts, and require online account verification after 30 days.

**Architecture:** Separate remembered account identity, local vault unlocking, and server session validity. A feature-local authentication controller owns startup, PIN enrollment, lockout, online verification, and recovery. Keep financial data encrypted locally, retain the existing user-scoped repositories and sync queue, and require valid server authentication for network operations.

**Tech Stack:** Expo SDK 55, React Native, TypeScript, Expo SecureStore, Expo SQLite/SQLCipher, Zustand, Express, Supabase Auth, Jest, React Native Testing Library, Supertest, Maestro.

## Global constraints

- Odin is a single-user-account application: `1 user = 1 account`.
- All persisted user data, including offline reads and queued writes, stays scoped to the authenticated `user_id`.
- Install Node dependencies with `pnpm` only; use Node `24.15.0` and pnpm `10.26.1`.
- Keep frontend work in `apps/app/`, API work in `apps/api/`, and reusable TypeScript contracts in `packages/` only when cross-app reuse exists.
- Reuse existing dependencies wherever adequate. Do not implement cryptographic algorithms manually.
- Never log PINs, tokens, encryption keys, or raw authentication payloads.
- Implementation was authorized on 2026-10-22, in the current checkout. Database resets, personal-device driving, and production changes are not authorized.
- Preserve unsynced records during lockout, session expiry, encryption migration, and PIN recovery.
- Require explicit confirmation for logout, PIN reset, and any intentional data removal.

## Agreed behavior and explicit defaults

| Condition | Required behavior |
| --- | --- |
| First use or new installation | Online login and completed PIN enrollment before offline access. |
| PIN format | Exactly six ASCII digits; preserve leading zeroes. Confirm PIN during setup. |
| Incorrect attempts 1–4 | Keep locked; show remaining attempts. |
| Incorrect attempt 5 | Start a 3,600,000 ms lockout immediately. |
| During lockout | Reject every PIN, including the correct PIN; show remaining time. |
| Lockout expiry | Offer five fresh attempts. Another five failures starts another full hour. |
| Successful unlock | Reset incorrect-attempt count to zero. |
| Restart, force-stop, background, network change | Preserve attempts and lockout; never renew the offline allowance. |
| Offline allowance | 30 × 24 hours since the last successful online account verification, using server time as the reference. |
| At or after allowance expiry | Require online verification before local data can reopen; keep queued records intact. |
| Online verification | Validate the current account with Supabase and the API; refresh tokens if needed. Prompt for normal password/Google login when the server session cannot be restored. |
| Successful online verification | Renew the 30-day allowance; do not bypass an active PIN lockout or unlock the vault automatically. |
| Offline logout | Disable with “Connect to the internet to log out.” Offer “Lock app” instead. Enforce in the handler as well as UI. |
| Forgot PIN | Online reauthentication to the same account, followed by explicit PIN-reset confirmation; no offline reset. |
| Confirmed server revocation or disabled account | Stop sync and lock local access immediately when learned online; preserve data for authorized recovery. |

Defaults proposed for implementation: PIN required online and offline; lock immediately when leaving the foreground; no biometrics in this initial feature. Existing enrolled users may continue offline within their allowance despite transient API failures. Existing installations without PIN enrollment must complete enrollment online before receiving offline access. Accounts with incomplete onboarding retain only the existing supported onboarding behavior; do not invent offline onboarding.

Online verification means a server-validated session, not mandatory password entry every 30 days if a valid refresh session remains available. This policy can renew during normal online usage after PIN unlock. It does not require a separate identity-verification product.

## Current source findings

- `apps/app/App.native.tsx` stores access token, refresh token, and provider in `odin.auth.session`. It does not persist the resolved application user/profile/onboarding identity needed for offline boot.
- Startup calls `supabase.auth.setSession()` followed by `POST /odin/api/auth/session`. Both the restoration error branch and the broad catch clear saved credentials, including on network failures.
- `apps/app/lib/supabase.ts` creates the client without an explicit native secure-storage adapter. Consolidate ownership of persisted session state and refresh writes rather than creating another independent token copy.
- `apps/app/local-db/client.ts` opens `odin.db` without SQLCipher key configuration. Schema migration registration also lives in that file.
- `apps/app/components/MobileShell.tsx` owns sync entry points and logout orchestration, including sync/discard flows. Sweep these paths together rather than adding a check only to the visible logout button.
- `apps/app/services/connectivity.ts` initially assumes online. Connectivity is a hint; request outcomes determine whether a server operation succeeded.
- `apps/api/src/routes/auth.ts` handles `/session`; route tests are in `apps/api/src/__tests__/routes/auth.session.test.ts`.

## Security design

The custom PIN protects ordinary use of a lost or borrowed phone. Local attempt limits and offline expiry cannot be made tamper-proof on a rooted/jailbroken device, or against arbitrary app-state rollback. A six-digit PIN has one million combinations; never claim hardware-enforced app-PIN attempt limits.

Encrypt the database with a random 256-bit data key. Protect that key with a PIN-derived wrapping key combined with a random device secret stored in SecureStore. Use a vetted slow KDF, unique salt, and authenticated encryption with fresh nonces. Store algorithm/version/work-factor metadata so upgrades can be performed after successful unlock. A plain SHA hash of the PIN is insufficient. Verify the PIN by authenticated key unwrapping; do not keep a separate plaintext PIN or an easily copied unsalted verifier.

For same-account online recovery, keep a separately protected recovery copy of the data key in platform secure storage. Expose its use only through the verified recovery service. This is an explicit availability tradeoff: custom PIN recovery does not provide the same isolation as a hardware credential. Keep tokens and keys out of UI stores; keep the unlocked data key only as long as necessary, close database handles and clear caches on lock, and avoid promising guaranteed memory erasure in JavaScript.

Persist attempt state, account identity, server verification timestamp, expiry timestamp, and a last-observed time in protected storage using opaque user-ID keys. Serialize unlock submissions and commit an attempt reservation before expensive PIN verification so force-stopping during verification does not restore an attempt. Storage corruption or write failure must leave the vault locked, without deleting user data.

Use elapsed/monotonic time while running, plus persisted timestamps across launches. Detect clock rollback against the last observed time and require online verification to repair trust. Online time repair must preserve any remaining lockout duration. Forward clock changes may prematurely expire access and must not silently shorten an active lockout. Across reboot, a wholly offline device lacks a fully trustworthy clock; document this residual limitation rather than promising perfect enforcement.

## File responsibilities

Create a feature under `apps/app/features/auth/`:

- `types.ts`: remembered identity, local access state, verification metadata, PIN results.
- `helpers/pinPolicy.ts`: pure PIN validation and five-attempt/one-hour transitions.
- `helpers/offlineAccessPolicy.ts`: 30-day expiry and clock-anomaly decisions.
- `services/authStorage.ts`: validated, versioned SecureStore records and legacy-session migration.
- `services/pinVault.ts`: cryptographic enrollment, key unwrapping, PIN changes, authorized recovery.
- `services/sessionService.ts`: Supabase/API restoration, refresh, verification, error classification.
- `stores/useAuthStore.ts`: hydration, enrollment, locked/unlocked state, lockout, and recovery orchestration with atomic selectors.
- `components/PinSetupScreen.tsx`, `PinUnlockScreen.tsx`, `OnlineVerificationScreen.tsx`: focused UI; PIN input remains local component state.
- `__tests__/`: policy, storage, crypto-adapter, controller, and component behavior tests.

Modify `App.native.tsx`, `lib/supabase.ts`, `local-db/client.ts`, `components/MobileShell.tsx`, `features/governance/PrivacySettingsScreen.tsx`, `app.config.ts`, `package.json`, and `README.md` as each deliverable needs them. Modify `apps/api/src/routes/auth.ts` and its tests to return trusted verification time. Put server timing logic in `apps/api/src/services/authVerification.ts` if extraction is needed. No Supabase schema change is expected.

## Task 1: Implement the access policies

**Files:** `features/auth/types.ts`, both policy helpers, and `features/auth/__tests__/pinPolicy.test.ts` / `offlineAccessPolicy.test.ts`, under `apps/app/`.

**Interfaces:**

```ts
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 60 * 60 * 1000;
export const OFFLINE_ACCESS_MS = 30 * 24 * 60 * 60 * 1000;
export type PinAttemptState = { failedAttempts: number; lockedUntil: number | null };
export type LocalAccessPhase =
  | "hydrating" | "signed-out" | "enrollment-required"
  | "locked" | "locked-out" | "verification-required" | "unlocked";
export type PinResult =
  | { status: "unlocked" }
  | { status: "incorrect"; attemptsRemaining: number }
  | { status: "locked-out"; remainingMs: number };
```

- [ ] Write failing tests for PIN format, failures 1–5, correct PIN before/after expiry, fresh budget after expiry, and successful reset. Test exactly one millisecond before expiry and at expiry.
- [ ] Add 30-day tests for one millisecond before expiry, exact expiry, expired records, invalid/missing timestamps, rollback detection, and PIN unlock never extending the allowance.
- [ ] Implement pure transitions with injected time. Apply the lockout and offline-expiry checks before attempting cryptographic unlock; neither policy overrides the other.
- [ ] Run `pnpm --filter app test --runInBand features/auth/__tests__/pinPolicy.test.ts features/auth/__tests__/offlineAccessPolicy.test.ts`; expect all boundary cases to pass.
- [ ] Commit as `feat(app): define offline PIN access and lockout policies`.

Representative required policy assertion (helper implementation exposes this signature):

```ts
// recordFailedPin(state: PinAttemptState, now: number): PinAttemptState
const now = 1_000_000;
expect(recordFailedPin({ failedAttempts: 4, lockedUntil: null }, now))
  .toEqual({ failedAttempts: 5, lockedUntil: now + PIN_LOCKOUT_MS });
```

## Task 2: Add secure enrollment and encrypted database lifecycle

**Files:** `services/authStorage.ts`, `services/pinVault.ts`, corresponding tests, `apps/app/local-db/client.ts`, `apps/app/app.config.ts`, `apps/app/package.json`, lockfile, and `apps/app/README.md` if present, otherwise root `README.md`.

**Interfaces:** `enrollPin(userId: string, pin: string): Promise<void>`, `unlockWithPin(userId: string, pin: string): Promise<PinResult>`, `lockVault(): Promise<void>`. `unlockWithPin` owns serialized, durable attempt accounting; callers cannot bypass it with direct key access.

- [ ] Inventory installed crypto capabilities. Select a maintained SDK-55-compatible KDF/AES-GCM implementation, check official support, and measure the KDF on an emulator. Record the exact library/version, KDF work factor, salt/nonce sizes, and measured unlock latency in this document before shipping. Add only the dependency needed to cover missing primitives with pnpm.
- [ ] Write failing behavioral tests for leading-zero PINs, wrong PIN key-unwrapping failure, fresh salts/nonces, malformed metadata, serialization of simultaneous submissions, storage failure, and restart during an attempt.
- [ ] Implement validated SecureStore records and cryptographic vault operations. Validate all restored JSON at runtime. Do not render financial UI when records are corrupt or missing; offer same-account online recovery without deleting the database.
- [ ] Enable `useSQLCipher: true` in the existing Expo SQLite plugin configuration and rebuild native artifacts. Set the database key before reads or migrations. Add explicit database close/reopen behavior for lock/unlock.
- [ ] Migrate plaintext `odin.db` by copying into a separate encrypted database with SQLCipher export. Verify integrity, schema versions, user-owned row counts, sync queue payloads, and reopenability before activating it. Preserve a recoverable source until verification completes; avoid in-place rekey assumptions for a plaintext database.
- [ ] Test interrupted export and activation recovery in a disposable database; prove queued writes survive and that wrong/missing keys cannot open the encrypted database. Check WAL/journal files and exclude migration artifacts and sensitive database files from platform backup. Define cleanup as part of the explicit enrollment/migration confirmation.
- [ ] Run `pnpm --filter app test --runInBand features/auth/__tests__ local-db/repositories/__tests__`; expect relevant suites to pass, reporting unrelated baseline failures separately.
- [ ] Commit as `feat(database): protect offline data with an encrypted PIN vault`.

## Task 3: Add online verification and a 30-day allowance

**Files:** `apps/api/src/routes/auth.ts`, `apps/api/src/__tests__/routes/auth.session.test.ts`, `apps/app/features/auth/services/sessionService.ts`, `authStorage.ts`, and corresponding app tests.

**Interfaces:** `verifyOnlineAccount(): Promise<{ userId: string; profileId: string; onboardingStatus: string; verifiedAt: number; offlineAccessExpiresAt: number }>`. Identity fields must come from successful API authentication, not editable local inputs. `/session` returns `verified_at` and `offline_access_expires_at` as UTC timestamps, computed server-side.

- [ ] Extend API tests: valid authorized request receives server timestamps exactly 30 days apart; unauthenticated and disabled/unverified accounts do not receive a renewed allowance. Validate any requested device metadata before use.
- [ ] Return timestamps only after the current `/session` authorization/profile checks succeed. Avoid relying on JWT decoding alone as proof of current server-side account status.
- [ ] Test and implement session restoration that classifies timeout, offline/network error, and 5xx as temporary; retains existing local credentials and allowance; and does not extend timestamps after failed requests.
- [ ] Treat confirmed invalid refresh credentials as a need for reauthentication. Treat permission denial separately from authentication failure. Do not clear local financial data for either condition.
- [ ] Configure a single SecureStore-backed Supabase persistence strategy. Persist rotated tokens even if the app is locally locked; token refresh must not change local unlock state or renew the allowance without successful API verification. Sweep `SIGNED_OUT` handlers and broad auth catches for unintended local record deletion.
- [ ] Test wrong-account reauthentication: it cannot renew or reset the original account's vault. Preserve original records and require the matching account.
- [ ] Run `pnpm --filter api test --runInBand src/__tests__/routes/auth.session.test.ts` and `pnpm --filter app test --runInBand features/auth/__tests__`; expect authorization, timing, rotation, and error-classification tests to pass.
- [ ] Commit as `feat(api): renew offline access after online account verification`.

## Task 4: Integrate startup and PIN screens

**Files:** auth store and screens listed above, `apps/app/App.native.tsx`, and `features/auth/__tests__/authLifecycle.test.tsx`.

- [ ] Write lifecycle tests with the full storage, Supabase, API, database, connectivity, and navigation call graph mocked in runtime-compatible shapes.
- [ ] Cover: existing legacy session needs enrollment; enrolled account cold-starts offline; expired access token still permits local PIN unlock inside the allowance; five failures persist across store rehydration; expiry screen protects data at 30 days; server renewal leaves PIN lockout active.
- [ ] Extract auth orchestration from `App.native.tsx` into the feature store. Render a hydration guard first, then enrollment, verification, PIN, or protected content according to phase. Never pass an empty `userId` to the shell.
- [ ] Implement masked numeric PIN entry, confirmation, attempt feedback, submission serialization, and a countdown that derives from persisted state. The countdown reaching zero does not itself unlock anything. Keep raw PIN input out of shared stores and clear it after submission/backgrounding.
- [ ] Recheck the offline allowance on foreground and while unlocked so remaining in the app cannot bypass the 30-day deadline. Cancel in-flight work and ignore stale results after lock or account change.
- [ ] Lock and obscure financial content immediately on backgrounding. Close database access, clear feature caches, and block pending callbacks from revealing protected content. Audit password recovery/verification deep links so they cannot open the vault without the PIN or verified reset flow.
- [ ] Run `pnpm --filter app test --runInBand features/auth/__tests__`; expect lifecycle and screen tests to pass with no financial-content flash.
- [ ] Commit as `feat(app): require PIN unlock for remembered offline accounts`.

## Task 5: Gate sync, logout, and PIN recovery

**Files:** `apps/app/components/MobileShell.tsx`, `apps/app/features/governance/PrivacySettingsScreen.tsx`, auth services/store, `apps/app/local-db/sync/runSync.ts`, and tests beside the affected modules.

- [ ] Sweep every sync and logout entry point, including manual retry, automatic reconnect, discard-and-logout, settings, and recovery callbacks. Add behavior tests before changing these paths.
- [ ] Allow sync only with unlocked local access, a valid 30-day allowance, and a currently authenticated server session for the same user. Refresh expired tokens once with serialized refresh handling before retrying requests. Never substitute a PIN or local identity record for bearer authentication.
- [ ] Disable offline logout visually and guard its handler. Recheck connectivity/session immediately before execution; network failure preserves the account. Keep existing unsynced-change confirmation flows and add an independent Lock app action.
- [ ] Require fresh same-account password or Google reauthentication for PIN reset, followed by an explicit confirmation explaining the PIN change and preservation of local records. Recover the data key, enroll a new PIN, and reset attempts only after verified recovery completes. Normal reconnect or passive session refresh does not reset lockout.
- [ ] Clear the session, PIN enrollment, cached identity, encryption-key accessibility, and shared UI caches after successful confirmed logout. Ensure retained encrypted records and queue entries cannot be opened by another account. Do not delete unsynced records as a side effect of failure.
- [ ] Test offline handler invocation, network loss during logout, token refresh races, revoked session, correct-account recovery, wrong-account denial, and two sequential account logins with distinct user-owned data.
- [ ] Run focused auth, shell, sync, and privacy suites using `pnpm --filter app test --runInBand`; scope filenames to the touched suites and expect all changed behaviors to pass.
- [ ] Commit as `feat(app): gate sync and account actions on local access`.

## Task 6: Verify and document the complete feature

**Files:** `apps/app/maestro/offline-pin-auth.yaml`, `docs/offline-sync/offline-sync-engine.md`, relevant README, and this plan's verification record.

- [ ] Add Maestro flows using the actual screen accessibility labels: setup, unlock online/offline, force-stop persistence, lockout countdown, recovery, and online expiry verification. Test one-hour/30-day boundaries with injected clocks in Jest; do not add production time-bypass flags for E2E.
- [ ] Run Maestro only on an emulator or when the user explicitly asks for on-device testing. Use a dedicated test account and disposable financial records; never modify existing user records. If a created test record is deleted, report its synced tombstone.
- [ ] Run `pnpm --filter app test --runInBand features/auth/__tests__` and `pnpm --filter api test --runInBand src/__tests__/routes/auth.session.test.ts` plus affected database/sync suites.
- [ ] Run `pnpm --filter app exec tsc --noEmit` and `pnpm --filter api exec tsc --noEmit`; distinguish pre-existing failures from changes introduced by this feature.
- [ ] Verify encrypted database upgrade and interrupted-upgrade recovery on a disposable installation with pending changes. Confirm normal online login, onboarding, password recovery, and Google login still work.
- [ ] Document exact policy, recovery, native rebuild requirements, backup behavior, clock limitations, and the limits of custom PIN enforcement. Record actual crypto choices and verification outcomes.
- [ ] Run `graphify update .` if available. Keep generated graph files local.
- [ ] Commit as `test(app): verify offline PIN security and recovery flows`.

## Acceptance checklist

- [ ] A previously enrolled account unlocks offline with its six-digit PIN.
- [ ] Attempts 1–4 show remaining attempts; attempt 5 starts exactly one hour of lockout.
- [ ] Correct PIN, restart, reconnect, and normal token refresh do not bypass active lockout.
- [ ] Lockout expiry gives five fresh attempts; successful unlock resets the budget.
- [ ] At exactly 30 days after successful server verification, local access requires online verification.
- [ ] PIN unlock, network detection, failed requests, and local timestamp edits do not constitute online verification.
- [ ] Online verification renews the allowance; an unavailable/expired server session prompts normal login.
- [ ] No protected-content flash occurs during hydration, foregrounding, deep linking, or recovery.
- [ ] Offline logout is blocked in every path and Lock app remains available.
- [ ] No PIN/key/token logging, plaintext PIN persistence, or unencrypted active financial database remains.
- [ ] Upgrade, expiry, failure, and authorized PIN reset preserve unsynced data and account ownership.
- [ ] Clock and compromised-device limitations are described accurately.

## Primary references

- [Expo SDK 55 Crypto](https://docs.expo.dev/versions/v55.0.0/sdk/crypto/): available cryptographic primitives; confirm KDF availability separately.
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/): SQLCipher configuration and native build requirements; validate against installed SDK 55 before implementation.
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/): platform storage and backup limitations.
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions): access tokens, refresh tokens, and session validity.
- [OWASP local authentication bypass](https://mas.owasp.org/MASWE/MASVS-AUTH/MASWE-0020/): cryptographic resource protection rather than a UI-only PIN gate.

## Verification record

Implemented in the current checkout on 2026-10-22. Changes remain uncommitted.

- Added feature-local authentication policies, secure account persistence, PIN key wrapping, store orchestration, PIN UI, and online renewal/recovery.
- Added SQLCipher configuration, account-specific encrypted files, verified plaintext export, interrupted-cleanup recovery, and an encrypted legacy archive to preserve prior accounts' unsynced data.
- Added immediate background locking, snapshot protection, sync cancellation/access checks, persistent confirmed-session rejection, offline logout blocking, and logout/reset confirmations.
- Cryptography: reused `@noble/hashes` 1.8.0, now a direct app dependency, for PBKDF2-HMAC-SHA256 at 600,000 iterations; 16-byte salts; 32-byte derived/data/device keys; Expo Crypto AES-GCM with fresh default 12-byte IVs and 16-byte tags. ASCII byte input avoids a Hermes TextEncoder dependency. No native-device latency measurement was performed.
- Focused auth/database/sync selection: 46 tests passed across 11 suites. API login, Google login, session, logout, and password-reset coverage: 50 tests passed across five suites.
- Added and passed two further lifecycle regressions: an expired account's recovery screen stays open, and the expiry timer does not repeatedly cancel pending online verification. Rechecked all 16 vault/lifecycle tests after the final guards.
- API TypeScript passes. App TypeScript reports existing forecasting, financial-plan, savings-allocation, migration-test and financial-plan fixture errors; none are in the changed authentication files.
- The broader sync suite retains its existing `legacy taxonomy pull convergence / does not restore retired taxonomy rows` failure, also documented in the earlier savings-goal-account-link plan. The other 64 tests in that run passed.
- Android prebuild and arm64 debug APK assembly passed. Android production JavaScript export produced a Hermes bundle. Native artifacts were not installed on a device.
- Built the installed Expo SQLite package's vendored SQLCipher for a disposable host check: export preserved a queued write and migration version, encrypted headers were verified, wrong/missing keys were denied, and the correct key reopened successfully.
- Graphify code graph updated locally. Added README documentation and an unexecuted Maestro flow.
- No personal device accessed; no existing financial records edited; no local database reset or production deployment performed. iOS build, target-device KDF timing, and Maestro execution remain release verification steps.

Implementation details differ slightly from the initial file list: one focused `PinAccessScreen` composes setup/unlock/verification presentation, native Supabase configuration is in `lib/supabase.native.ts`, and reusable protected-storage/request helpers live under `lib/helpers/`. The slow KDF and AES behavior are tested with real algorithms, with native transport mocked in Jest.

### PIN setup responsiveness correction

The original Noble async PBKDF2 ran its 600,000 iterations on the JavaScript
thread and yielded only to microtasks. A regression test showed a zero-delay UI
timer could not run during derivation. This caused long loading periods under
Hermes; read-only inspection of the affected phone showed high process CPU and
no encrypted database yet, consistent with a stall before database migration.

Moved key derivation to the local Expo module `apps/app/modules/odin-pin-crypto`,
using Android SecretKeyFactory and iOS CommonCrypto on the native async queue.
The input encoding, salt size, work factor, and output remain compatible with
existing PIN envelopes. Native derivation has a bounded response deadline;
an older installed APK shows a rebuild message rather than a startup crash.
The Android platform provider requires API 26+. iOS compilation remains a macOS
verification step. This change adds no third-party native cryptography library.

Verified the previously failing UI-timer test, cross-implementation key vector,
timeout/missing-module handling, setup error cleanup, native validation tests,
and rebuilt the Android APK. No user records were changed and no APK was installed
on the user's device during this correction.

### Android envelope decoding correction

SDK 55's JavaScript `AESSealedData.fromCombined` advertises base64 string input,
but the installed Android native method requires a byte array. Passing the saved
string threw a conversion error that our broad decryption catch turned into an
incorrect-PIN result. Corrected the boundary by decoding base64 before calling
native code and moving conversion outside the authentication-failure catch.
Promoted the already-installed `base64-js` codec to a direct app dependency.

Updated the native mock to reject string input, reproduced a correct PIN failing,
then verified the fix. Added a full vault reset round trip using real key
derivation/encryption: replacement PIN succeeds, old PIN fails, the attempt budget
resets, and the recovery/data key is unchanged. All 45 auth checks passed. This
correction preserves existing envelope contents and needs only a JS reload.

### Database file URI correction

The next device trace confirmed successful PIN derivation and AES unwrapping,
then failed before the first database open. Android SQLite supplies its default
directory as a bare filesystem path; the new FileSystem API expects a file URI.
Normalized the directory at the filesystem boundary, preserved existing file
URIs, and added safe handling for an unavailable directory. No storage-permission
request or database relocation is involved.

Corrected the filesystem mock to enforce URI input instead of accepting arbitrary
paths, observed the existing migration tests fail, and verified the correction.
The focused auth and encrypted-database checks now pass all 52 tests, including
bare Android paths, existing file URIs, source preservation on failure, and cleanup
after verified migration. No personal-device records were changed by the agent.

# Native offline account access

An online login enrolls a six-digit PIN for this installation. PIN unlock applies
online and offline. Five incorrect submissions lock PIN entry for one hour;
expiry grants five new attempts, and a successful unlock resets the count.
Concurrent submissions are serialized and each attempt is persisted before key
verification, so an interrupted verification conservatively consumes an attempt.

Successful server account verification grants 30 days of offline access. Normal
online use can renew it after PIN unlock. Local unlock, connectivity detection,
and failed HTTP calls never renew it. At expiry, Budgie requires online verification;
it uses the existing session where possible and requests normal login otherwise.
Confirmed authentication rejection is persisted and prevents offline reopening.

Forgot PIN requires a fresh password or Google login to the same account and an
explicit reset confirmation. The protected recovery key preserves local data and
pending writes. Logout requires connectivity and confirmation; Lock app works
offline. Backgrounding locks the app and cancels sync requests. The UI never
uses the PIN as server authentication.

## Storage and cryptography

- SecureStore records use `WHEN_UNLOCKED_THIS_DEVICE_ONLY` on iOS and Android's
  encrypted platform storage. Storage keys use opaque user IDs.
- The local Expo module `modules/odin-pin-crypto` runs PBKDF2-HMAC-SHA256 with
  600,000 iterations on a native worker: Android SecretKeyFactory and iOS
  CommonCrypto. It retains the original 16-byte salt, 32-byte result, and PIN
  plus random device-secret input, so existing envelopes remain compatible.
  Native derivation has a 30-second response deadline; missing native code shows
  an update-build message instead of hanging or crashing startup. Android's
  platform SHA-256 PBKDF2 provider requires API 26 or newer.
- Expo Crypto supplies secure randomness and native AES-256-GCM. The wrapping
  envelope uses its default fresh 12-byte nonce and 16-byte authentication tag.
  Saved base64 envelopes are decoded with `base64-js` before `fromCombined`:
  the SDK 55 Android native method requires bytes. Decode/conversion failures
  propagate as operational errors rather than being labeled incorrect PINs.
- SQLCipher uses a random 32-byte key and account-specific database files.
  Refresh tokens stay in the SecureStore record, outside the UI store.
  Convert SQLite's bare Android database directory to a `file:///` URI before
  using Expo FileSystem; preserve directories already supplied as file URIs.
- Encryption upgrade exports the old database to a separate file, compares all
  table counts, verifies integrity and reopenability, then activates it. An
  encrypted upgrade archive preserves old shared-database records for other
  accounts' first verified enrollment. Original plaintext files are removed only
  after successful verification. Interrupted cleanup is resumed on reopening.
- Android cloud backup and device transfer exclude application data. The iOS
  config plugin excludes Documents from backup because restored database files
  would not have this installation's keys.

## Build and verification

This feature needs a native build; refreshing JavaScript or Expo Go is
insufficient. Deploy the API `/auth/session` timestamp additions before clients
that require them. Rebuild from the app directory:

```bash
pnpm exec expo prebuild --platform android --no-install
pnpm exec expo run:android
```

The APK must include `OdinPinCrypto`; Metro refresh alone cannot install this
module. Run the native compatibility and validation tests from `apps/app/android`:

```bash
./gradlew :odin-pin-crypto:testDebugUnitTest :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

Use the matching iOS prebuild/build workflow on macOS with Google configuration.
Prebuild enables SQLCipher and applies backup exclusions. Keep pre-existing
native customizations and never use a clean prebuild casually.

Run focused checks from the repository root:

```bash
pnpm --filter app test --runInBand features/auth/__tests__ local-db/__tests__
pnpm --filter api test -- src/__tests__/routes/auth.session.test.ts
```

Maestro's `apps/app/maestro/offline-pin-auth.yaml` uses an already enrolled,
dedicated test account. Device interaction requires an explicit user request.
No developer account records should be modified during testing. Measure KDF
latency on target devices before release; host-Jest timings do not predict Hermes
performance. There are no production time-override switches.

## Development diagnostics

PIN setup and unlock emit `[PIN-SETUP]` stage logs in development builds. Each
step records `started`, `completed`, or `failed`, its duration, and a safe failure
category. A pending step emits `waiting` every five seconds. Arguments, results,
raw exceptions, SQL, file paths, PINs, tokens, and encryption keys are excluded.
Find the first failed step or the deepest step that keeps reporting waiting.
Logs appear in Metro or in the `ReactNativeJS` logcat stream. Reload JavaScript
and retry setup/reset to capture a new trace; no native rebuild is needed for
these diagnostic logs.

## Limits

Custom app PIN enforcement and timers do not provide hardware-enforced guessing
limits. A rooted/jailbroken device can bypass app logic or restore old state.
The app detects backward time relative to persisted observations and clock jumps
within its process; a restart with a forward-changed clock is not fully detectable
offline. Online verification repairs clock trust without resetting a PIN lockout.
Remote revocation cannot be learned while disconnected; that exposure is bounded
by the 30-day allowance on an uncompromised device with a trustworthy clock.

The separately stored recovery key and encrypted legacy archive are an explicit
availability tradeoff. They allow authenticated same-account recovery without
losing offline records; they do not provide protection equivalent to tying key
access to hardware-enforced biometrics/device credentials. JavaScript memory
erasure cannot be guaranteed. Uninstalling the app can permanently remove unsynced
data and must never be offered as PIN recovery.

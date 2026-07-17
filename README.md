# Odin

Monorepo for the main Odin application.

## Repositories

- `apps/app`: Expo app for React Native mobile
- `apps/api`: Express API written in TypeScript
- `packages/`: reserved for shared packages

## Tech Stack

- Node.js `24.15.0` LTS
- pnpm `10.26.1`
- TypeScript `5.9.2`
- React `19.2.0`
- React Native `0.83.6`
- Expo SDK `55`
- Express `5.1.0`
- Supabase JS `2.57.4`
- NativeWind, Tailwind CSS, React Native Paper, `@expo/vector-icons`

## Prerequisites

Install these before working in this repository:

- Node.js `24.15.0` LTS
- Corepack enabled
- pnpm `10.26.1`

Version pins in this repo:

- `.nvmrc`
- `.node-version`
- `package.json` via `packageManager`

Optional but typically needed for mobile work:

- Expo development builds for native Google Sign-In testing
- Android Studio for Android emulator and device builds
- JDK 21 for Android builds
- Android SDK Platform 36, Build-Tools, Emulator, and platform-tools (`adb`)
- Xcode for iOS simulator on macOS

## Environment Variables

Create an `.env` file from the example templates:

### App (`apps/app/.env`)

No `.env.example` is present yet. The app uses:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`

### API (`apps/api/.env.example` → `apps/api/.env`)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_REDIRECT_URL=
PORT=3001
```

Do not commit real secrets.

## What Is Already Wired

### Frontend (App)

- Auth experience: email+password login, registration, password reset, Google Sign-In, consent gate
- Privacy consent screen (first-time modal)
- 11-step onboarding flow with financial profile assessment
- Dashboard shell with drawer navigation and bottom toolbar
- Taxonomy screen: CRUD for category groups, categories, and subcategories (local-first with offline sync via SQLite)
- Privacy settings: 5 toggles (personalization, model training, research, notifications, data retention)
- User profile with data export request management
- Account offboarding: multi-step deletion flow
- Placeholder pages for: Transactions, History, Spending Forecast, Anomaly Alerts, Budget Advice, Savings & Goals, Debt Manager, Insurance, Assistant, and Add Transaction
- Offline sync engine: SQLite-based queue, push/pull sync with cursor-based API
- Toast notification system
- Deep link handling for password recovery and email verification

### Backend (API)

29 endpoints across 10 route modules:

| Route Module | Endpoints |
|---|---|
| `auth` | register, login, logout, session restore, password reset, password update, Google sign-in |
| `me` | get/update user profile |
| `eligibility-profile` | get/update eligibility data |
| `privacy` | get/update privacy settings |
| `consents` | record user consent |
| `push-device-tokens` | register device token |
| `data-export-requests` | list/create export requests |
| `account-deletion-requests` | create/confirm/cancel deletion (30-day delay) |
| `onboarding` | create/update session, upsert responses, submit (triggers profile assessment) |
| `profile` | get/confirm/reject/select/reassign financial profile assignment |
| `sync` | push local changes, pull server changes, register device |

### Database

19 Supabase migrations covering the full schema: user profiles, onboarding, financial profiles, taxonomy, transactions, budgets, savings goals, debt, forecasts, anomalies, alerts, reports, and sync infrastructure.

### Testing

- **API unit tests**: 18 test files (Jest + Supertest)
- **E2E tests**: 23 Maestro test cases in `qa/.maestro/` (auth, consent, settings, navigation, offline/sync, security)
- **Smoke test script**: `scripts/test-routes.sh`

## Commands

```bash
pnpm dev:app        # Expo app
pnpm dev:web        # Expo web
pnpm dev:api        # Express API (defaults to port 3001)
pnpm --filter api build
pnpm --filter app exec tsc --noEmit
pnpm test           # Run all tests
```

## Android Device Flow

1. Connect an Android phone with USB debugging enabled.
2. Verify with `adb devices`.
3. Make the host API reachable: `adb reverse tcp:3001 tcp:3001`.
4. Start the API: `pnpm dev:api`.
5. Start the app: `pnpm --filter app android`.

For Android emulator, use `http://10.0.2.2:3001` as `EXPO_PUBLIC_API_BASE_URL`.

## Troubleshooting

### `pnpm` warns about package manager version

```bash
corepack prepare pnpm@10.26.1 --activate
```

### Expo starts but styles don't load

Verify these files exist, then restart Expo:

- `apps/app/babel.config.js`
- `apps/app/metro.config.js`
- `apps/app/global.css`
- `apps/app/tailwind.config.js`

### Native or web dependencies out of sync

```bash
pnpm install
```

## Recommended Next Steps

- Add `.env.example` for the app
- Add app unit tests (Jest is installed, no test files yet)
- Add shared packages under `packages/`
- Add CI/CD pipeline and Docker support
- Implement placeholder pages (Transactions, Dashboard, Budget, etc.)

## Dev Instructions

### Arch Linux

```bash
sudo pacman -S --needed jdk21-openjdk android-tools android-sdk-cmdline-tools-latest
source /etc/profile
sudo chown -R $USER:$USER /opt/android-sdk
/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager "build-tools;35.0.0" "platforms;android-35" --sdk_root=/opt/android-sdk
/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses --sdk_root=/opt/android-sdk
mkdir -p ~/.gradle
echo "org.gradle.java.home=/usr/lib/jvm/java-21-openjdk" >> ~/.gradle/gradle.properties
/opt/android-sdk/platform-tools/adb devices
```

From the repo root:

```bash
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```

### Linux Mint

```bash
sudo apt update
sudo apt install openjdk-21-jdk android-sdk
sdkmanager --licenses
# If sdkmanager is not on PATH:
# /usr/lib/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses
mkdir -p ~/.gradle
echo "org.gradle.java.home=/usr/lib/jvm/java-21-openjdk-amd64" >> ~/.gradle/gradle.properties
export ANDROID_HOME=/usr/lib/android-sdk
adb devices
```

From the repo root:

```bash
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```

### Windows

Install Microsoft OpenJDK 21 and Android Studio.

In Android Studio, install: Android SDK Platform 36, Build-Tools, Emulator, Platform-Tools.

Accept SDK licenses via PowerShell:

```powershell
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
```

If `ANDROID_HOME` is not set, find it in Android Studio (Settings → Appearance & Behavior → System Settings → Android SDK) and set it:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

Create `$env:USERPROFILE\.gradle\gradle.properties` with:

```properties
org.gradle.java.home=C:\Program Files\Microsoft\jdk-21.0.11-hotspot
```

Adjust the path to match your installed JDK 21 location.

Add platform-tools to `PATH`, then verify:

```powershell
adb devices
```

From PowerShell in the repo root:

```powershell
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```

## Repository Layout

```text
odin/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── __tests__/
│   │   │   ├── lib/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   ├── .env.example
│   │   ├── jest.config.cjs
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── app/
│       ├── components/
│       ├── features/
│       │   ├── governance/
│       │   ├── onboarding/
│       │   └── taxonomy/
│       ├── hooks/
│       ├── lib/
│       ├── local-db/
│       ├── services/
│       ├── App.tsx
│       ├── app.config.ts
│       ├── global.css
│       ├── package.json
│       └── tsconfig.json
├── docs/
├── packages/
├── plans/
├── qa/.maestro/
├── scripts/
├── supabase/migrations/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Recurring Transaction Engine

The recurring engine is an idempotent SQL function (`odin.run_recurring_transaction_engine`) that scans active templates and posts occurrences and transactions. It is exposed via:

```
POST /odin/api/recurring/run
```

**Authentication:** The endpoint rejects user Bearer tokens (403). Call with `x-cron-secret` header matching the `RECURRING_CRON_SECRET` env var.

**Cron setup:** Configure a Supabase scheduled function (or external cron) to hit this endpoint hourly:

```bash
curl -X POST https://your-api.com/odin/api/recurring/run \
  -H "x-cron-secret: ${RECURRING_CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Optional payload: `{ "payload": { "as_of": "2024-01-15", "limit": 200 } }`

# Odin

Monorepo for the main Odin application.

This repository currently contains:

- `apps/app`: Expo app for React Native mobile
- `apps/api`: Express API written in TypeScript
- `packages/`: reserved for shared packages

## Tech Stack

- Node.js `24.15.0` LTS
- pnpm `10.26.1`
- TypeScript `5.9.2`
- React `19.2.0`
- React Native `0.83.0`

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
- JDK 17 for Android builds
- Android SDK Platform 36, Build-Tools, Emulator, and platform-tools (`adb`)
- Xcode for iOS simulator on macOS

## Repository Layout

```text
odin/
├─ .gitignore
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  └─ index.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  └─ app/
│     ├─ App.tsx
│     ├─ app.json
│     ├─ babel.config.js
│     ├─ global.css
│     ├─ index.ts
│     ├─ metro.config.js
│     ├─ nativewind-env.d.ts
│     ├─ package.json
│     ├─ tailwind.config.js
│     └─ tsconfig.json
├─ packages/
├─ README.md
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

## Environment Variables

The current scaffold does not require runtime secrets yet, but these are the variables you should expect to add next.

Create an `.env` file when Supabase and service URLs are ready:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
API_BASE_URL=http://localhost:3001
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=
```

For the API, you will likely also need:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PORT=3001
```

Do not commit real secrets.

## What Is Already Wired

- Shared monorepo TypeScript base config
- Expo app scaffold
- NativeWind config for app styling
- React Native Paper in the app shell
- Express API entrypoint with `/` and `/health`

## Current API Endpoints

The API currently exposes:

- `GET /`
- `GET /health`
- `POST /odin/api/auth/google`
- `POST /odin/api/auth/session`
- `POST /odin/api/auth/logout`

Default local API URL:

```text
http://localhost:3001
```

## Troubleshooting

### `pnpm` warns about package manager version

Run:

```bash
corepack prepare pnpm@10.26.1 --activate
```

### Expo starts but the app does not load styles

Make sure these files exist and were not renamed:

- `apps/app/babel.config.js`
- `apps/app/metro.config.js`
- `apps/app/global.css`
- `apps/app/tailwind.config.js`

Then restart Expo completely.

### Native or web dependencies seem out of sync

From the repo root:

```bash
pnpm install
```

If needed, remove `node_modules` and reinstall manually.

## Recommended Next Steps

- Add `.env.example`
- Add shared packages under `packages/`
- Add Jest config for app and API
- Add Maestro E2E tests
- Add Supabase client wrappers
- Add Dockerfile for the API service

## Dev Instructions

### Arch Linux

Install the Android prerequisites:

```bash
sudo pacman -S --needed jdk17-openjdk android-tools
```

Install Android Studio from the official download, then keep the SDK in Android
Studio's SDK Manager.

Then install these SDK components in Android Studio:

- Android SDK Platform 36
- Android SDK Build-Tools
- Android Emulator
- Platform-Tools

Make sure `adb` is on your PATH:

```bash
adb devices
```

From the repo root:

```bash
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```

### Linux Mint

Install the Android prerequisites:

```bash
sudo apt update
sudo apt install openjdk-17-jdk
```

Install Android Studio from the official download, then use SDK Manager to add:

- Android SDK Platform 36
- Android SDK Build-Tools
- Android Emulator
- Platform-Tools

Make sure `adb` works:

```bash
adb devices
```

From the repo root:

```bash
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```

### Windows

Install Microsoft OpenJDK 17 and Android Studio.

In Android Studio, install these SDK components:

- Android SDK Platform 36
- Android SDK Build-Tools
- Android Emulator
- Platform-Tools

Add the Android platform-tools folder to `PATH`, then verify:

```powershell
adb devices
```

From PowerShell in the repo root:

```powershell
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```

### Android Device Flow

Use a physical Android phone for local development:

1. Connect an Android phone.
2. Turn on Developer Options.
3. Turn on USB debugging.
4. Make sure `adb devices` shows the phone.
5. Make the host API reachable from the phone with `adb reverse tcp:3001 tcp:3001` or set `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP.
6. Start the API with `pnpm run --filter api dev`.
7. Start the app with `pnpm run --filter app android`.

The app talks to the API on `EXPO_PUBLIC_API_BASE_URL`.
If you are testing on an Android emulator instead of a phone, `localhost`
points at the emulator itself. Use `http://10.0.2.2:3001` for the API base URL
when the API is running on your host machine.

### Commands

```bash
pnpm dev:app
pnpm dev:web
pnpm dev:api
pnpm --filter api build
pnpm --filter app exec tsc --noEmit
pnpm test
```

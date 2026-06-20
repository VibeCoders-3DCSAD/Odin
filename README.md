# Odin

Monorepo for the main Odin application.

This repository currently contains:

- `apps/app`: Expo app for React Native mobile and React Native Web
- `apps/api`: Express API written in TypeScript
- `packages/`: reserved for shared packages

## Tech Stack

- Node.js `24.15.0` LTS
- pnpm `10.26.1`
- TypeScript `5.9.2`
- React `19.2.0`
- React Native `0.83.0`
- React Native Web `0.21.0`
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
- Android Studio for Android emulator
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

## First-Time Setup

### Windows

Use PowerShell from the repo root:

```powershell
cd C:\path\to\App\odin
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```

Start the frontend:

```powershell
pnpm dev:app
```

Start the web build:

```powershell
pnpm dev:web
```

Start the API:

```powershell
pnpm dev:api
```

### Bash

Use this on Linux, macOS, WSL, or Git Bash:

```bash
cd /path/to/App/odin
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```

Start the frontend:

```bash
pnpm dev:app
```

Start the web build:

```bash
pnpm dev:web
```

Start the API:

```bash
pnpm dev:api
```

### Fish

```fish
cd /path/to/App/odin
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install
```

Start the frontend:

```fish
pnpm dev:app
```

Start the web build:

```fish
pnpm dev:web
```

Start the API:

```fish
pnpm dev:api
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

## Google Auth QA

The Expo app entry screen is currently a Google auth smoke-test page. It calls
native Google Sign-In, sends the Google ID token to
`POST /odin/api/auth/google`, and displays the Supabase session bootstrap
response.

This flow uses `@react-native-google-signin/google-signin`, so it does not work
inside Expo Go. Use an Expo development build or EAS development build when
testing Google auth.

Set `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` to the reversed iOS client ID, such as
`com.googleusercontent.apps.<id>`, so the native iOS callback URL is registered
correctly in the Expo config plugin.

Local iOS native builds also need that Google iOS config. If you run
`expo prebuild`, `expo run:ios`, or another native iOS build path without
`EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` or `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, the
config now fails fast instead of generating a broken native callback setup.

For Android emulator testing, `localhost` points at the emulator itself. Use
`http://10.0.2.2:3001` as the API base URL when the API is running on your host
machine.

## Common Commands

Install dependencies:

```bash
pnpm install
```

Run the mobile app:

```bash
pnpm dev:app
```

Run the web app:

```bash
pnpm dev:web
```

Run the API in watch mode:

```bash
pnpm dev:api
```

Build the API:

```bash
pnpm --filter api build
```

Type-check the Expo app:

```bash
pnpm --filter app exec tsc --noEmit
```

Run workspace tests:

```bash
pnpm test
```

## What Is Already Wired

- Shared monorepo TypeScript base config
- Expo app scaffold
- React Native Web support through Expo
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
- Add Playwright web tests
- Add Supabase client wrappers
- Add Dockerfile for the API service

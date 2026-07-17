# Scripts

Helper scripts for local development. Prefer these when they match your OS and workflow; use the manual alternatives below when you do not want the helper.

| Script | Platform | Purpose |
| --- | --- | --- |
| `run-android.ps1` | Windows | Build/run the Expo Android app from a short real checkout |
| `rn-config-short-path.mjs` | Windows (legacy) | Path rewriter for subst-based builds; unused by the current helper |
| `test-routes.sh` | Bash | Smoke-test Odin API routes with `curl` |

---

## `run-android.ps1`

Windows-only helper for the real Expo app in `apps/app`.

Deep monorepo paths exceed Ninja’s ~260-character limit. `subst` / junctions look short, but Gradle/Kotlin canonicalize them back to `C:\Users\...`, which then mixes drive roots and breaks the build.

This script instead:

1. Ensures a **real** short git worktree at `C:\odin` (not a junction)
2. Runs `pnpm install` there
3. Syncs local `apps/app/.env`, `app.config.ts`, and gitignored `android/`
4. Forces short `GRADLE_USER_HOME=C:\g` and `TEMP`/`TMP=C:\t`
5. Starts the `Small_Phone` AVD if no device is connected
6. Clears stale native/Kotlin caches
7. Builds from `C:\odin\apps\app` with the JS bundle **embedded** in the debug APK
   (so launch does not depend on a live Metro/IP tunnel)

### Usage

From the **main** repo checkout in PowerShell:

```powershell
# Terminal 1 — API (required for login; “No internet” in the app usually means API unreachable)
pnpm dev:api

# Terminal 2 — app
.\scripts\run-android.ps1
```

### Emulator networking notes

- Emulator Wi‑Fi (`AndroidWifi`) can be up while the app still shows “No internet”.
- That message means the app could not reach `EXPO_PUBLIC_API_BASE_URL` (see `apps/app/lib/network.ts`).
- For the Android emulator, use:
  ```env
  EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001
  ```
- Keep `pnpm dev:api` running. Health check: `http://127.0.0.1:3001/health`
- Physical devices need your LAN/Tailscale IP instead of `10.0.2.2`.

### Manual alternative (Windows)

```powershell
# one-time: real short worktree (remove any old C:\odin junction first)
cd <your-long-repo>
rmdir C:\odin 2>$null
git worktree add --detach C:\odin HEAD
cd C:\odin
pnpm install
copy <long-repo>\apps\app\.env apps\app\.env
# copy or prebuild android/ as needed

$env:GRADLE_USER_HOME = "C:\g"
$env:TEMP = "C:\t"
$env:TMP = "C:\t"
cd C:\odin\apps\app
pnpm android
```

### Manual alternative (Linux / macOS)

```bash
pnpm --filter app android
```

### Do not

- Do **not** run `pnpm expo run:android` from the monorepo root.
- Do **not** add a global `~/.gradle/init.gradle` that redirects `buildDir`.
- Do **not** rely on `subst O:` for Gradle builds — it reintroduces mixed `O:`/`C:` roots.

---

## `test-routes.sh`

Curl-based smoke tests for the Express API.

```bash
export API_BASE="http://localhost:3001"
bash scripts/test-routes.sh
```

Optional: `SUPABASE_ACCESS_TOKEN` to exercise auth-required routes.

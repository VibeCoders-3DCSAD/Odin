# Frontend Backend Interaction Catalog

**Scope:** `apps/app` — all `*.ts`, `*.tsx` files
**Generated:** 2026-07-09
**Purpose:** Inventory of every network call for offline-first migration planning

---

## Infrastructure

| File | Line | Detail |
|---|---|---|
| `lib/supabase.ts` | 6 | `createClient(supabaseUrl, supabaseAnonKey)` — Supabase client init |
| `lib/api.ts` | 1 | `API_BASE_URL` — config constant |
| `lib/api.ts` | 2 | `REQUEST_TIMEOUT_MS = 10_000` — global fetch timeout |

---

## Supabase Auth (Direct)

| # | File | Line | Call | Type |
|---|---|---|---|---|
| 1 | `hooks/useDeepLink.ts` | 60 | `supabase.auth.exchangeCodeForSession(code)` — verification | AUTH |
| 2 | `hooks/useDeepLink.ts` | 82 | `supabase.auth.exchangeCodeForSession(code)` — password reset | AUTH |
| 3 | `App.native.tsx` | 72–75 | `supabase.auth.signInWithIdToken({ provider: "google", token })` | AUTH |

---

## REST API Calls (by endpoint)

### Auth

| # | Endpoint | Method | File | Line | Type | Called From |
|---|---|---|---|---|---|---|
| 4 | `/odin/api/auth/login` | POST | `components/AuthExperience.tsx` | 468 | AUTH | `handleLogin()` |
| 5 | `/odin/api/auth/register` | POST | `components/AuthExperience.tsx` | 529 | AUTH | `handleRegister()` |
| 6 | `/odin/api/auth/session` | POST | `components/AuthExperience.tsx` | 89, 542, 659 | READ | `bootstrapSession()` (3 call sites) |
| 7 | `/odin/api/auth/password-reset` | POST | `components/AuthExperience.tsx` | 576 | AUTH | `handlePasswordReset()` |
| 8 | `/odin/api/auth/password-update` | POST | `components/AuthExperience.tsx` | 620 | AUTH | `handlePasswordUpdate()` |
| 9 | `/odin/api/auth/logout` | POST | `components/AuthExperience.tsx` | 696 | AUTH | `handleLogout()` |
| 10 | `/odin/api/auth/logout` | POST | `components/MobileShell.tsx` | 153 | AUTH | `handleLogout()` |

### User / Profile

| # | Endpoint | Method | File | Line | Type | Called From |
|---|---|---|---|---|---|---|
| 11 | `/odin/api/me?include=consents` | GET | `components/AuthExperience.tsx` | 483, 663 | READ | `handleLogin()`, `handleGoogle()` |
| 12 | `/odin/api/me?include=consents` | GET | `features/governance/PrivacySettingsScreen.tsx` | 278 | READ | `useEffect` |

### Consents

| # | Endpoint | Method | File | Line | Type | Called From |
|---|---|---|---|---|---|---|
| 13 | `/odin/api/consents` | POST | `features/governance/PrivacyConsentScreen.tsx` | 80 | CREATE | `handleAgree()` |

### Privacy

| # | Endpoint | Method | File | Line | Type | Called From |
|---|---|---|---|---|---|---|
| 14 | `/odin/api/privacy/settings` | GET | `features/governance/PrivacySettingsScreen.tsx` | 277, 348 | READ | `useEffect`, retry button |
| 15 | `/odin/api/privacy/settings` | PATCH | `features/governance/PrivacySettingsScreen.tsx` | 306 | UPDATE | `save()` callback |

### Categories / Taxonomy

| # | Endpoint | Method | File | Line | Type | Called From |
|---|---|---|---|---|---|---|
| 16 | `/odin/api/category-groups` | GET | `features/taxonomy/TaxonomyScreen.tsx` | 223 | READ | `fetchGroups()` |
| 17 | `/odin/api/categories` | POST | `features/taxonomy/CategoryFormScreen.tsx` | 77 | CREATE | `handleSave()` |
| 18 | `/odin/api/categories/:id` | PATCH | `features/taxonomy/CategoryFormScreen.tsx` | 79 | UPDATE | `handleSave()` |
| 19 | `/odin/api/categories/:id` | DELETE | `features/taxonomy/TaxonomyScreen.tsx` | 264 | DELETE | `handleDelete()` |

### Data Export

| # | Endpoint | Method | File | Line | Type | Called From |
|---|---|---|---|---|---|---|
| 20 | `/odin/api/data-export-requests` | GET | `features/governance/UserProfileScreen.tsx` | 52 | READ | `useEffect` |
| 21 | `/odin/api/data-export-requests` | POST | `features/governance/UserProfileScreen.tsx` | 69, 150 | CREATE | `handleExport()`, confirm re-export |

### Account Deletion

| # | Endpoint | Method | File | Line | Type | Called From |
|---|---|---|---|---|---|---|
| 22 | `/odin/api/account-deletion-requests` | POST | `features/governance/AccountOffboardingScreen.tsx` | 56 | CREATE | `handleDelete()` |
| 23 | `/odin/api/account-deletion-requests/:id/confirm` | POST | `features/governance/AccountOffboardingScreen.tsx` | 72 | CREATE | `handleDelete()` |
| 24 | `/odin/api/account-deletion-requests/:id/cancel` | POST | `features/governance/api.ts` | 117 | UPDATE | defined, not called from UI yet |

---

## API Client Wrappers

| File | Type | Detail |
|---|---|---|
| `features/taxonomy/api.ts` | `apiFetch<T>()` | Generic wrapper, prefixes `API_BASE_URL`, adds `Authorization` header |
| `features/governance/api.ts` | `apiFetch<T>()` | Identical pattern, locally defined |
| `components/AuthExperience.tsx` | `postJson<T>()` | Internal helper, builds `POST` with JSON body, auth header |

---

## Summary

| Category | Count |
|---|---|
| Total call sites | 27 |
| Distinct API endpoints | 18 |
| Direct Supabase Auth calls | 3 |
| Reads | 9 |
| Writes (CREATE/UPDATE/DELETE) | 12 |
| Auth flows | 6 |
| WebSocket / realtime | 0 |
| Axios / third-party HTTP libs | 0 |

**All HTTP calls use native `fetch()`. No realtime subscriptions found.**

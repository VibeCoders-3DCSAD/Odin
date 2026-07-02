# Technology Stack — Odin

**Status**: Finalized  
**Date**: 2026-07-01  
**Source**: `AGENTS.md`, `README.md`, `package.json`, `requirements.txt`, `.nvmrc`, `.python-version`, `Specification.md`

---

## 1. Mobile Frontend (React Native + Expo)

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | React Native | 0.83.6 |
| UI Library | React | 19.2.0 |
| Toolchain | Expo SDK | ~55.0.26 |
| Language | TypeScript | 5.9.2 |
| Styling | NativeWind (Tailwind) | 4.2.3 |
| Material UI | React Native Paper | 5.15.1 |
| Icons | @expo/vector-icons | 15.1.1 |
| State management | Zustand | 5.0.12 |
| Auth (native) | @react-native-google-signin | 16.1.2 |
| Auth (backend) | @supabase/supabase-js | 2.57.4 |
| Animations | react-native-reanimated | 4.4.1 |
| Navigation | Expo Router | (Expo SDK bundled) |
| Bundler | Metro | (Expo SDK bundled) |

**Platform IDs**: iOS `com.odin.finances`, Android `com.odin.finances`

---

## 2. Backend API (Express)

| Layer | Choice | Version |
|-------|--------|---------|
| Runtime | Node.js (LTS) | 24.15.0 |
| Package manager | pnpm | 10.26.1 |
| HTTP framework | Express | 5.1.0 |
| Language | TypeScript | 5.9.2 |
| Dev runner | tsx | 4.21.0 |
| Database | Supabase (PostgreSQL) | — |
| Supabase Client | @supabase/supabase-js | 2.57.4 |
| CLI | Supabase CLI | 2.105.0 |
| Environment | dotenv | 17.4.2 |

**Architecture**: Routes → Controllers → Services → Middleware pattern.

---

## 3. Machine Learning Service (FastAPI)

| Layer | Choice | Version |
|-------|--------|---------|
| Runtime | Python | 3.14.4 |
| Web framework | FastAPI | 0.135.3 |
| ASGI server | Uvicorn | — |
| Deep learning | TensorFlow | 2.21.0 |
| Classical ML | scikit-learn | 1.8.0 |

**ML Models**:

| Model | Algorithm | Purpose |
|-------|-----------|---------|
| Financial Behavioral Profile | Random Forest | Classify users into 4 FBP types |
| Spending Forecaster | LSTM (TensorFlow) | Predict future spending by category |
| Anomaly Detector | Isolation Forest | Detect unusual/risky transactions |
| Budget Recommender | Linear Programming | Generate optimal budget allocations |

---

## 4. Database

- **PostgreSQL** via Supabase
- Migrations in `supabase/migrations/`
- RLS (Row Level Security) enabled
- Auth handled by Supabase Auth

---

## 5. Testing

| Area | Tool | Version |
|------|------|---------|
| Frontend unit | Jest + React Native Testing Library | 29.7.0 / 13.3.3 |
| Backend unit | Jest | 30.3.0 |
| API integration | Supertest | 7.2.2 |
| E2E (native) | Maestro | — |
| Python/ML | Pytest + HTTPX | — |

---

## 6. Deployment

- **Android**: Google Play Store (APK via Expo dev builds)
- **iOS**: Explicitly **excluded from thesis scope** (per Specification v4.0)
- **Mobile-first**: 375dp minimum, no horizontal scroll 320–450dp

---

## 7. Architecture Layout

```
odin/                         # Monorepo (pnpm workspace)
├── apps/
│   ├── app/                  # Expo mobile + RN Web frontend
│   └── api/                  # Express backend
├── packages/                 # Shared TS packages (reserved)
├── supabase/                 # DB migrations, config
├── schema/                   # SQL schema drafts, ERDs
└── docs/                     # Specs, PRDs, ADRs
odin-ml/                      # FastAPI ML microservice
odin-standards/               # Engineering standards
```

---

## 8. Key Decisions

- **Single-user-account** application (data scoped by `user_id`)
- **Zustand** with per-domain store discipline (no server-state library yet)
- **Offline-first**: core features work offline (LSTM forecasting excluded)
- **Android-only** for mobile distribution
- All ML models served server-side via FastAPI microservice
- Expo dev builds required for native Google Sign-In (not Expo Go compatible)

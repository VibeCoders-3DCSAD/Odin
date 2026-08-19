# VIB-158 Execution Plan

## Goal

Deliver budget recommendations as an online-generated, offline-viewable proposal flow while isolating the unknown Python microservice contract behind a small adapter seam. The Node API owns authentication, authorization, persistence, and orchestration; the Python service generates proposals; the app displays cached results and lets the user accept, modify, or reject them.

## Source Of Truth

- Linear: https://linear.app/vibe-coders-odin/issue/VIB-158/phase-3c-budget-recommendations-cached-execution
- Phase 3b dependency: `plans/vib-164-execution-plan.md`
- Hard implementation gate: VIB-295 must complete before recommendation acceptance or restriction-aware recommendation behavior.
- Remote recommendation schema: `supabase/migrations/20260616064145_priority_modules_v3.sql:2356-2389` and adjacent recommendation allocation tables
- Existing app/API sync and cache patterns: `apps/app/local-db/repositories/dashboardSnapshots.ts`, `apps/app/local-db/sync/`, `apps/api/src/services/syncService.ts`

## Non-Goals

- Do not couple the mobile app directly to the Python microservice.
- Do not finalize the Python transport, URL, authentication mechanism, or model payload before the contract discovery phase.
- Do not let a recommendation mutate a budget automatically; acceptance remains an explicit user action.
- Do not generate recommendations offline; offline mode only displays the latest cached proposal and its status.
- Do not add a second sync engine or treat generated recommendation output as ordinary user CRUD.
- Do not accept recommendations against provisional Phase 3b behavior where protected/fixed categories are temporarily treated as `OPEN`.

## Execution Order

1. Wait for VIB-295 reconciliation before implementing acceptance or restriction-aware behavior.
2. Complete contract discovery and fake-provider work only against documented provisional interfaces.
3. Implement cache, orchestration, and UI after the finalized budgeting repository and constants are available.

## PR Stacking Strategy

```text
main
└─ feat/vib-158-budget-recommendations-cached-execution
   ├─ feat/vib-158-suggestion-contract
   │  └─ feat/vib-158-suggestion-adapter
   │     └─ feat/vib-158-recommendation-cache
   │        └─ feat/vib-158-recommendation-orchestration
   │           └─ feat/vib-158-recommendation-ui
```

Build each branch from the previous stack tip and target each PR at its immediate parent. Keep the Python transport behind the adapter until the contract is approved.

## Linear Sub-Issue Tracking

- Create child issues under `VIB-158` for the five phases below when implementation begins.
- Use `feat/` branch names only; do not include a personal username in branch names.

### 1. Contract Discovery And Fixtures

- Add `docs/contracts/budget-suggestions.md` with the provisional request/response contract, unresolved decisions, JSON fixtures, error states, and versioning rules.
- Define the stable domain interface independently of transport: `SuggestionInput`, `SuggestionResult`, proposed allocation shape, explanation fields, restriction violations, data freshness, recommendation run ID, and model/service version metadata.
- Resolve whether generation is synchronous or job-based, whether input is a snapshot or live read, what data crosses the Node-to-Python seam, how stale inputs are represented, and how partial/unavailable results are reported. Do not add a Python client yet.

### 2. Adapter Seam And Fake Implementation

- Add a small Node module under `apps/api/src/services/budgetSuggestions/` exposing the provider interface and validation for normalized domain input/output.
- Define the seam as `BudgetSuggestionProvider.generate(input): Promise<BudgetSuggestion>`; callers must not know the Python URL, HTTP headers, serialization, retry policy, or model details.
- Add a deterministic fake adapter backed by fixtures for API tests and local development. This proves orchestration and persistence without waiting for the Python contract or service availability.

### 3. Recommendation Cache And Persistence

- Add the required remote migration for recommendation runs, recommendation allocations, explanations, and explicit decision state, reusing existing schema tables where possible rather than inventing parallel records.
- Add local SQLite cache tables/migration and a focused repository for the latest recommendation, run metadata, proposed allocations, explanations, and accept/modify/reject state. Cache successful online results for offline viewing; preserve stale and unavailable status explicitly.
- Keep generated results derived and immutable. A user-modified or accepted budget allocation must go through the VIB-164 budget repository and normal budget sync path, not overwrite the original recommendation result.
- Use the reconciled VIB-295 repository and `apps/app/features/budgeting/constant.ts` for feasibility checks and accepted-budget creation; 3c must not duplicate budget policy.

### 4. API Orchestration And Python Adapter

- Add an authenticated API route/service that loads a user-scoped budget snapshot, taxonomy, restrictions, and relevant ledger aggregates, validates the input, calls `BudgetSuggestionProvider`, persists the result, and returns a normalized response.
- Implement the Python adapter only after Phase 1 fixtures stabilize. Map transport-specific failures into stable domain errors, set explicit timeouts, avoid logging financial payloads, and make retries/idempotency safe for repeated generation requests.
- Keep Python service details isolated to one adapter. Replacing the fake adapter with the Python adapter must not change route consumers, database repositories, or UI state handling.

### 5. Cached Recommendation UI And Decisions

- Add a focused feature under `apps/app/features/budget-recommendations/` and update navigation only as needed.
- Read the latest recommendation locally first; show generated time, input freshness, explanations, warnings, stale/unavailable state, and proposed allocations. Refresh requires network and must never erase the last valid cache on failure.
- Require explicit accept, modify, and reject actions. Accept/modify creates or updates VIB-164 budget/allocation rows through the local repository; reject records decision state without silently changing the active budget.

## Adapter Seam

```text
Node API orchestration
          |
          v
BudgetSuggestionProvider  <- stable domain interface
          |
          +--> FakeSuggestionProvider       (fixtures/tests)
          +--> PythonSuggestionProvider     (real service)
```

The rest of Odin depends only on `BudgetSuggestionProvider` and the normalized domain types. The adapter owns Python URL/configuration, authentication, request serialization, response parsing, timeout behavior, and transport error translation.

## Acceptance Criteria

- The provisional contract is documented with fixtures and unresolved decisions before Python integration begins.
- API callers depend on the provider interface, not Python transport details.
- Fake adapter tests cover successful, partial, stale-input, invalid-output, timeout, and unavailable-service cases.
- The Python adapter can be added or replaced without changing budget UI or persistence callers.
- Recommendation results are cached locally and viewable offline with freshness/status metadata.
- Protected or locked restrictions are represented in the result and cannot be silently violated during acceptance.
- Accept, modify, and reject are explicit user actions and preserve the original recommendation run.
- Acceptance and restriction-aware validation are blocked until VIB-295 is complete.
- Generation is authenticated, user-scoped, timeout-bounded, idempotency-safe, and does not log sensitive financial payloads.

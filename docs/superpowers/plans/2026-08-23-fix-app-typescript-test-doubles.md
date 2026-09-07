# Fix App TypeScript Test Doubles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app TypeScript project compile cleanly by correcting existing Jest mocks and SQLite test doubles without changing production behavior.

**Architecture:** Keep the fixes local to the failing tests. Give each mock the narrow generic signature that its production seam expects, make SQLite doubles implement the generic `PullDb` contract, and use real `Response` instances for `fetch` tests. Do not add a shared mock framework or loosen compiler settings.

**Tech Stack:** TypeScript 5.9, Jest 29, Expo SQLite, React Native app.

## Global Constraints

- Preserve `strict: true` and `noUncheckedIndexedAccess: true`.
- Do not weaken `apps/app/tsconfig.json` or add `skipLibCheck`/casts to bypass these errors.
- Do not change production runtime behavior to accommodate tests.
- Keep database test doubles user-scoped and aligned with the existing SQLite method signatures.
- Run commands from the repository root with `pnpm`.

---

## Baseline

The current red command is:

```bash
pnpm exec tsc -p apps/app/tsconfig.json --noEmit
```

It currently fails in these test files:

- `apps/app/local-db/repositories/__tests__/dashboardSnapshots.test.ts`
- `apps/app/local-db/repositories/__tests__/dashboardSummary.test.ts`
- `apps/app/local-db/repositories/__tests__/financialFoundations.test.ts`
- `apps/app/local-db/repositories/__tests__/ledger.test.ts`
- `apps/app/local-db/repositories/__tests__/taxonomyScope.test.ts`
- `apps/app/local-db/sync/__tests__/pullConvergence.test.ts`
- `apps/app/local-db/sync/__tests__/runSync.test.ts`

The errors fall into four causes: untyped Jest mocks infer `never`; test files without imports are treated as scripts and redeclare `mockInitDatabase`; generic SQLite methods are replaced by concrete-returning functions; and the fetch mock is not a `Response`.

## Task 1: Type Dashboard SQLite Mocks

**Files:**
- Modify: `apps/app/local-db/repositories/__tests__/dashboardSnapshots.test.ts`
- Modify: `apps/app/local-db/repositories/__tests__/dashboardSummary.test.ts`

**Interfaces:**
- Preserve the repository-facing mock calls and assertions.
- Define local row shapes only for the fields returned by each repository.

- [ ] **Step 1: Type the snapshot mocks.**

In `dashboardSnapshots.test.ts`, replace the three bare mocks with explicit function signatures matching their use:

```ts
type SnapshotRow = {
  id: string;
  user_id: string;
  source: string;
  payload_json: string;
  updated_at: string;
};

const mockRunAsync = jest.fn<() => Promise<unknown>>();
const mockGetFirstAsync = jest.fn<(sql: string, ...params: unknown[]) => Promise<SnapshotRow | null>>();
const mockGetAllAsync = jest.fn<(sql: string, ...params: unknown[]) => Promise<SnapshotRow[]>>();
```

Use the same signatures when configuring `initDatabase`; do not change the SQL assertions.

- [ ] **Step 2: Type the dashboard summary mocks and narrow indexed calls.**

In `dashboardSummary.test.ts`, define row types for the account aggregate, month aggregate, and recent transaction rows. Give `mockGetFirstAsync` a return type covering `null` and those row shapes, and give `mockGetAllAsync` a recent-transaction-array return type.

For the two `mock.calls[0]` reads, avoid unchecked indexing by using:

```ts
const balanceCall = mockGetFirstAsync.mock.calls[0];
expect(balanceCall).toBeDefined();
if (!balanceCall) throw new Error("expected balance query");
expect(balanceCall[1]).toBe("user-42");
```

Apply the same pattern to `recentCall` and retain the existing assertions.

- [ ] **Step 3: Run the focused compiler check.**

Run:

```bash
pnpm exec tsc -p apps/app/tsconfig.json --noEmit
```

Expected: no errors from `dashboardSnapshots.test.ts` or `dashboardSummary.test.ts`; remaining failures are limited to the other listed files.

## Task 2: Fix Repository Test Module Scope and Transaction Doubles

**Files:**
- Modify: `apps/app/local-db/repositories/__tests__/financialFoundations.test.ts`
- Modify: `apps/app/local-db/repositories/__tests__/ledger.test.ts`
- Modify: `apps/app/local-db/repositories/__tests__/taxonomyScope.test.ts`

**Interfaces:**
- Keep the existing mocked modules and test behavior.
- Match `withTransactionAsync` with a callback of type `() => Promise<void>`.

- [ ] **Step 1: Make script-style tests modules.**

Add `export {};` as the first statement of `financialFoundations.test.ts` and `ledger.test.ts`. This prevents their top-level `mockInitDatabase` declarations from colliding when the app `tsconfig` includes all tests in one TypeScript program.

- [ ] **Step 2: Correct the financial foundations mock signatures.**

In `financialFoundations.test.ts`, change `MockDb.withTransactionAsync` from a callback-that-receives-a-transaction signature to:

```ts
withTransactionAsync: jest.Mock<Promise<void>, [work: () => Promise<void>]>;
```

Keep the implementation as an async function that invokes `work()`. Give the module mock functions rest-argument signatures that accept the arguments passed by the mock wrappers, instead of relying on an untyped `jest.fn()` inference.

- [ ] **Step 3: Type taxonomy mocks and guard indexed calls.**

In `taxonomyScope.test.ts`, type `mockGetAllAsync` as a function returning `Promise<unknown[]>` and `mockGetFirstAsync` as a function returning `Promise<unknown | null>` with SQL and bind parameters accepted. Guard each of the three `mock.calls[index]` reads before accessing `[0]`, preserving the existing query assertions.

- [ ] **Step 4: Run repository-test typechecking.**

Run:

```bash
pnpm exec tsc -p apps/app/tsconfig.json --noEmit
```

Expected: no errors from `financialFoundations.test.ts`, `ledger.test.ts`, or `taxonomyScope.test.ts`.

## Task 3: Align Sync SQLite Doubles

**Files:**
- Modify: `apps/app/local-db/sync/__tests__/pullConvergence.test.ts`
- Modify: `apps/app/local-db/sync/__tests__/runSync.test.ts`

**Interfaces:**
- `PullDb.getFirstAsync` remains generic: `<T>(sql, ...params) => Promise<T | null>`.
- `runSync` continues to receive the production SQLite database shape from `initDatabase`.

- [ ] **Step 1: Implement the generic `PullDb` fake.**

In `pullConvergence.test.ts`, import the `PullDb` type and SQLite bind/result types. Define `fakeDb` with generic methods:

```ts
function fakeDb(existing: { version: number; user_id: string } | null): PullDb & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getFirstAsync: async <T>(sql: string, ..._params: SQLite.SQLiteBindValue[]) => {
      calls.push(sql);
      return existing as T | null;
    },
    runAsync: async (sql: string, ..._params: SQLite.SQLiteBindValue[]) => {
      calls.push(sql);
      return {} as SQLite.SQLiteRunResult;
    },
  };
}
```

Use the existing tests unchanged. The cast is limited to the deliberately generic fake boundary; it must not be added to production code.

- [ ] **Step 2: Type the `runSync` database fake.**

In `runSync.test.ts`, import `SQLite` as a type and define `createDb()` with generic `getAllAsync`/`getFirstAsync` methods compatible with the SQLite database API. Type `mockInitDatabase` with `jest.mocked(initDatabase)` rather than a bare `as jest.Mock` where possible.

- [ ] **Step 3: Return real `Response` objects from fetch mocks.**

Replace the plain `{ ok, json }` objects in both fetch mocks with native `Response` instances. For successful JSON responses, use:

```ts
new Response(JSON.stringify({ payload: { changes: {}, cursors: {}, successful: true } }), {
  status: 200,
  headers: { "content-type": "application/json" },
});
```

Use the same shape for the `has_more` pagination response. Keep the registration response as `new Response(null, { status: 200 })`, and assign the mock using Jest’s typed mock helper instead of casting an incompatible function to `typeof fetch`.

- [ ] **Step 4: Run sync tests and typechecking.**

Run:

```bash
pnpm exec tsc -p apps/app/tsconfig.json --noEmit
pnpm --dir apps/app test -- --runInBand local-db/sync/__tests__/pullConvergence.test.ts local-db/sync/__tests__/runSync.test.ts
```

Expected: TypeScript passes and both sync test files pass.

## Task 4: Full Verification and Cleanup

**Files:**
- Modify only the test files listed in Tasks 1-3.

- [ ] **Step 1: Run the complete app test suite.**

Run:

```bash
pnpm --dir apps/app test -- --runInBand
```

Expected: all existing app tests pass.

- [ ] **Step 2: Run the compiler twice to confirm deterministic output.**

Run:

```bash
pnpm exec tsc -p apps/app/tsconfig.json --noEmit
pnpm exec tsc -p apps/app/tsconfig.json --noEmit
```

Expected: both commands exit with status 0 and produce no diagnostics.

- [ ] **Step 3: Review the diff for scope.**

Run:

```bash
git diff --stat -- apps/app
git diff --check -- apps/app
```

Expected: changes are limited to typing test mocks/test doubles and no production `.ts`/`.tsx` files or compiler options were changed.

- [ ] **Step 4: Commit the fix.**

```bash
git add apps/app/local-db/repositories/__tests__ apps/app/local-db/sync/__tests__
git commit -m "fix(frontend): type app test database doubles"
```

Do not stage the unrelated existing worktree changes.

## Self-Review

- [x] The plan covers every TypeScript diagnostic observed in the baseline compiler run.
- [x] The plan keeps the strict compiler settings enabled.
- [x] The plan avoids a new shared abstraction because the failures are local and the existing test doubles have different row shapes.
- [x] The plan uses a real `Response` instead of suppressing the fetch type error.

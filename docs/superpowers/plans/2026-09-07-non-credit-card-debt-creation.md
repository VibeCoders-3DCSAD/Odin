# Non-Credit-Card Debt Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build non-credit-card debt creation, editing, listing, archiving, deletion, and status/progress display for Debt Manager without implementing payment recording or repayment strategy flows.

**Architecture:** Add a focused local-first `debtAccounts` repository around the existing `debt_accounts` table, storing common loan columns in first-class columns and type-specific fields in `preset_data` JSON. Add small Debt Manager UI components for list, detail summary, and create/edit form, then wire them into the existing `DebtManagerOverview`. Keep credit cards separate: credit cards remain financial accounts and are not created as generic debt records.

**Tech Stack:** Expo React Native, TypeScript, expo-sqlite, Jest, React Native Testing Library, existing Odin local sync queue.

## Global Constraints

- Source of truth: `docs/requirements-engineering/feature-modules.md`, section 7.9 through 7.25.
- Scope includes: create/edit debt records, select debt type, view debt list, view status/progress, view remaining payments summary, archive debt, mark deleted debt, and type-specific creation fields.
- Scope excludes: debt payment recording, related transaction creation/linking, Snowball/Avalanche strategy implementation, prioritization UI, hardship plan implementation, and payment history mutation.
- Default payment state: every newly created debt starts with no payment history and displays the empty-payment-history/no-payment state.
- Credit cards are not generic debt records; they stay in the Credit Card module.
- All persisted user-owned data must be scoped by `user_id`.
- Install and run Node commands with `pnpm` only.
- Do not add new dependencies unless existing project dependencies cannot solve the problem.
- Keep frontend code in `apps/app/`; keep backend sync hardening in `apps/api/` only if the local payload shape changes beyond existing server support.

---

## File Structure

- Create: `apps/app/local-db/repositories/debtAccounts.ts`
  - Owns non-credit-card debt domain types, validation, row mapping, list/get/create/update/archive/delete operations, and sync enqueue payloads.
- Create: `apps/app/local-db/repositories/__tests__/debtAccounts.test.ts`
  - Unit-tests repository validation, user scoping, create payloads, update payloads, archive/delete status behavior, and no-payment defaults.
- Create: `apps/app/features/debt-manager/debtTypes.ts`
  - UI-safe debt type labels, options, type-specific select options, and placeholder copy from feature modules.
- Create: `apps/app/features/debt-manager/NonCreditDebtForm.tsx`
  - Create/edit form for section 7.13, 7.14, 7.15, 7.15.1, 7.22, and 7.23 fields.
- Create: `apps/app/features/debt-manager/NonCreditDebtList.tsx`
  - Active/archived/deleted-aware list rendering with status/progress labels.
- Create: `apps/app/features/debt-manager/NonCreditDebtDetail.tsx`
  - Read-only selected-debt summary with remaining balance, no-payment state, status/progress, archive/delete/edit actions.
- Modify: `apps/app/features/debt-manager/DebtManagerOverview.tsx`
  - Wire non-credit-card debts into the existing Debt Manager overview while keeping Credit Cards as a separate card.
- Create: `apps/app/features/debt-manager/__tests__/NonCreditDebtForm.test.tsx`
  - Tests form validation, placeholders, type-specific fields, and successful create/edit calls.
- Create: `apps/app/features/debt-manager/__tests__/DebtManagerOverview.nonCreditDebts.test.tsx`
  - Tests list/empty/detail/archive/delete UI behavior.
- Optional only if repository payload fields are rejected by server sync: modify `apps/api/src/services/syncApplyOperation.ts` and add tests in `apps/api/src/__tests__/services/syncApplyOperation.debtAccounts.test.ts`.

---

### Task 1: Debt Account Repository Types, Mapping, and Listing

**Files:**
- Create: `apps/app/local-db/repositories/debtAccounts.ts`
- Create: `apps/app/local-db/repositories/__tests__/debtAccounts.test.ts`

**Interfaces:**
- Consumes: existing SQLite table `debt_accounts` from `apps/app/local-db/migrations/019_debt_management.ts` plus columns from migrations 020, 022, and 023.
- Produces:
  - `DebtTypePreset`
  - `DebtAccountStatus`
  - `DebtProgressStatus`
  - `DebtAccount`
  - `DebtPresetData`
  - `listDebtAccounts(userId: string, visibility?: DebtListVisibility): Promise<DebtAccount[]>`
  - `getDebtAccount(userId: string, id: string): Promise<DebtAccount | null>`
  - `deriveDebtProgress(debt: Pick<DebtAccount, "currentBalanceCentavos" | "minimumPaymentCentavos" | "nextDueDate" | "status">): DebtProgressStatus`

- [ ] **Step 1: Write failing repository list tests**

Create `apps/app/local-db/repositories/__tests__/debtAccounts.test.ts` with this starting content:

```ts
import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockEnqueueOperation = jest.fn<(...args: any[]) => any>();
const mockRandomUUID = jest.fn(() => "debt-1");

jest.mock("../../client", () => ({
  initDatabase: (...args: any[]) => mockInitDatabase(...args),
}));

jest.mock("../../helpers", () => {
  const actual = jest.requireActual("../../helpers") as Record<string, unknown>;
  return {
    ...actual,
    enqueueOperation: (...args: any[]) => mockEnqueueOperation(...args),
  };
});

jest.mock("../../uuid", () => ({
  randomUUID: () => mockRandomUUID(),
}));

type MockDb = {
  getAllAsync: jest.Mock<any>;
  getFirstAsync: jest.Mock<any>;
  runAsync: jest.Mock<any>;
  withTransactionAsync: jest.Mock<any>;
};

function createDbMock(overrides: Partial<MockDb> = {}): MockDb {
  return {
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async () => undefined),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => { await work(); }),
    ...overrides,
  };
}

const baseDebtRow = {
  id: "debt-1",
  user_id: "user-1",
  linked_account_id: null,
  name: "Car loan",
  lender_name: "Bank A",
  preset_key: "auto_loan",
  status: "active",
  original_balance_centavos: 50000000,
  current_balance_centavos: 45000000,
  annual_interest_rate_bps: 650,
  minimum_payment_centavos: 1500000,
  payment_frequency: "monthly",
  next_due_date: "2026-10-01",
  maturity_date: "2030-10-01",
  target_payoff_date: null,
  interest_period: "annual",
  interest_method: "diminishing_balance",
  preset_data: JSON.stringify({
    startDate: "2026-01-01",
    feesCentavos: 0,
    penaltyInfo: "Late fee applies after grace period.",
    autoLoan: {
      vehicleDescription: "Toyota Vios",
      vehiclePurchasePriceCentavos: 60000000,
      downpaymentCentavos: 10000000,
      financedPrincipalCentavos: 50000000,
    },
  }),
  notes: "Primary commute vehicle",
  payment_schedule: JSON.stringify({ termMonths: 48 }),
  paid_off_at: null,
  archived_at: null,
  version: 1,
  deleted: 0,
  created_at: "2026-09-07T00:00:00.000Z",
  updated_at: "2026-09-07T00:00:00.000Z",
  last_synced_at: null,
};

describe("debtAccounts repository", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset();
    mockRandomUUID.mockClear();
    mockEnqueueOperation.mockResolvedValue({ operation_id: "sync-1" });
  });

  test("listDebtAccounts maps active non-credit-card debts for the current user", async () => {
    const db = createDbMock({ getAllAsync: jest.fn(async () => [baseDebtRow]) });
    mockInitDatabase.mockResolvedValue(db);

    const { listDebtAccounts } = await import("../debtAccounts");

    const debts = await listDebtAccounts("user-1", "active");

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("FROM debt_accounts"),
      "user-1",
      "active",
    );
    expect(debts[0]).toMatchObject({
      id: "debt-1",
      name: "Car loan",
      type: "auto_loan",
      status: "active",
      progress: "on_schedule",
      hasPaymentHistory: false,
      currentBalanceCentavos: 45000000,
      typeSpecific: {
        autoLoan: {
          vehicleDescription: "Toyota Vios",
          financedPrincipalCentavos: 50000000,
        },
      },
    });
  });

  test("getDebtAccount returns null when the debt belongs to another user or is deleted", async () => {
    const db = createDbMock({ getFirstAsync: jest.fn(async () => null) });
    mockInitDatabase.mockResolvedValue(db);

    const { getDebtAccount } = await import("../debtAccounts");

    await expect(getDebtAccount("user-1", "missing-debt")).resolves.toBeNull();
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = ? AND id = ?"),
      "user-1",
      "missing-debt",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir apps/app test -- debtAccounts.test.ts --runInBand
```

Expected: FAIL because `../debtAccounts` does not exist.

- [ ] **Step 3: Implement repository types, mapping, list, get, and progress derivation**

Create `apps/app/local-db/repositories/debtAccounts.ts`:

```ts
import * as SQLite from "expo-sqlite";
import { initDatabase } from "../client";

export const DEBT_TYPES = [
  "personal_loan",
  "salary_loan",
  "multipurpose_loan",
  "business_loan",
  "auto_loan",
  "custom_debt",
] as const;

export const DEBT_STATUSES = ["active", "archived", "deleted", "paid_off"] as const;

export type DebtTypePreset = typeof DEBT_TYPES[number];
export type DebtAccountStatus = typeof DEBT_STATUSES[number];
export type DebtListVisibility = "active" | "archived" | "deleted" | "all";
export type DebtProgressStatus = "ahead" | "on_schedule" | "behind" | "finished" | "no_payments";
export type InterestMethod = "flat_add_on" | "diminishing_balance" | "provider_calculated" | "no_interest";
export type InterestRatePeriod = "annual" | "monthly" | "per_term" | "none";
export type PaymentFrequency = "weekly" | "biweekly" | "semi_monthly" | "monthly" | "quarterly" | "custom";

export type DebtPresetData = {
  startDate: string | null;
  feesCentavos: number;
  penaltyInfo: string | null;
  termMonths: number | null;
  personalLoan?: { purpose: string | null };
  salaryLoan?: {
    linkedIncomeSourceId: string | null;
    repaymentMethod: "payroll_deduction" | "automatic_debit" | "manual_payment" | "other" | null;
    deductionAmountCentavos: number | null;
    deductionSchedule: PaymentFrequency | null;
  };
  multipurposeLoan?: { purposes: string[] };
  businessLoan?: { linkedBusinessOrIncomeSourceId: string | null; purpose: string | null };
  autoLoan?: {
    vehicleDescription: string | null;
    vehiclePurchasePriceCentavos: number | null;
    downpaymentCentavos: number | null;
    financedPrincipalCentavos: number | null;
  };
  customDebt?: { providerCalculatedInterest: boolean };
};

export type DebtAccount = {
  id: string;
  name: string;
  lenderName: string | null;
  type: DebtTypePreset;
  status: DebtAccountStatus;
  progress: DebtProgressStatus;
  originalBalanceCentavos: number;
  currentBalanceCentavos: number;
  annualInterestRateBps: number;
  minimumPaymentCentavos: number;
  paymentFrequency: PaymentFrequency;
  nextDueDate: string | null;
  maturityDate: string | null;
  targetPayoffDate: string | null;
  interestPeriod: InterestRatePeriod | null;
  interestMethod: InterestMethod | null;
  notes: string | null;
  typeSpecific: DebtPresetData;
  hasPaymentHistory: boolean;
  archivedAt: string | null;
  paidOffAt: string | null;
  version: number;
};

type DebtAccountRow = {
  id: string;
  user_id: string;
  linked_account_id: string | null;
  name: string;
  lender_name: string | null;
  preset_key: string;
  status: string;
  original_balance_centavos: number;
  current_balance_centavos: number;
  annual_interest_rate_bps: number;
  minimum_payment_centavos: number;
  payment_frequency: string;
  next_due_date: string | null;
  maturity_date: string | null;
  target_payoff_date: string | null;
  interest_period: string | null;
  interest_method: string | null;
  preset_data: string;
  notes: string | null;
  payment_schedule?: string;
  paid_off_at?: string | null;
  archived_at?: string | null;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

function parsePresetData(raw: string | null): DebtPresetData {
  const fallback: DebtPresetData = {
    startDate: null,
    feesCentavos: 0,
    penaltyInfo: null,
    termMonths: null,
  };
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<DebtPresetData>) };
  } catch {
    return fallback;
  }
}

function normalizeDebtType(type: string): DebtTypePreset {
  return DEBT_TYPES.includes(type as DebtTypePreset) ? type as DebtTypePreset : "custom_debt";
}

function normalizeStatus(status: string, deleted: number): DebtAccountStatus {
  if (deleted === 1) return "deleted";
  return DEBT_STATUSES.includes(status as DebtAccountStatus) ? status as DebtAccountStatus : "active";
}

export function deriveDebtProgress(debt: Pick<DebtAccount, "currentBalanceCentavos" | "minimumPaymentCentavos" | "nextDueDate" | "status">): DebtProgressStatus {
  if (debt.status === "paid_off" || debt.currentBalanceCentavos === 0) return "finished";
  if (!debt.nextDueDate || debt.minimumPaymentCentavos <= 0) return "no_payments";
  const today = new Date().toISOString().slice(0, 10);
  if (debt.nextDueDate < today) return "behind";
  return "on_schedule";
}

function mapDebt(row: DebtAccountRow): DebtAccount {
  const mapped = {
    id: row.id,
    name: row.name,
    lenderName: row.lender_name,
    type: normalizeDebtType(row.preset_key),
    status: normalizeStatus(row.status, row.deleted),
    progress: "no_payments" as DebtProgressStatus,
    originalBalanceCentavos: row.original_balance_centavos,
    currentBalanceCentavos: row.current_balance_centavos,
    annualInterestRateBps: row.annual_interest_rate_bps,
    minimumPaymentCentavos: row.minimum_payment_centavos,
    paymentFrequency: row.payment_frequency as PaymentFrequency,
    nextDueDate: row.next_due_date,
    maturityDate: row.maturity_date,
    targetPayoffDate: row.target_payoff_date,
    interestPeriod: row.interest_period as InterestRatePeriod | null,
    interestMethod: row.interest_method as InterestMethod | null,
    notes: row.notes,
    typeSpecific: parsePresetData(row.preset_data),
    hasPaymentHistory: false,
    archivedAt: row.archived_at ?? null,
    paidOffAt: row.paid_off_at ?? null,
    version: row.version,
  } satisfies DebtAccount;

  return { ...mapped, progress: deriveDebtProgress(mapped) };
}

export async function listDebtAccounts(userId: string, visibility: DebtListVisibility = "active"): Promise<DebtAccount[]> {
  const db = await getDb();
  let sql = "SELECT * FROM debt_accounts WHERE user_id = ?";
  const params: SQLite.SQLiteBindValue[] = [userId];

  if (visibility === "active") {
    sql += " AND deleted = 0 AND status = ?";
    params.push("active");
  } else if (visibility === "archived") {
    sql += " AND deleted = 0 AND status = ?";
    params.push("archived");
  } else if (visibility === "deleted") {
    sql += " AND deleted = 1";
  } else {
    sql += " AND (deleted = 0 OR status = 'deleted')";
  }

  sql += " ORDER BY status = 'active' DESC, updated_at DESC, name COLLATE NOCASE ASC";
  const rows = await db.getAllAsync<DebtAccountRow>(sql, ...params);
  return rows.map(mapDebt);
}

export async function getDebtAccount(userId: string, id: string): Promise<DebtAccount | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DebtAccountRow>(
    "SELECT * FROM debt_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  return row ? mapDebt(row) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --dir apps/app test -- debtAccounts.test.ts --runInBand
```

Expected: PASS for the two list/get tests.

- [ ] **Step 5: Commit**

```bash
git add apps/app/local-db/repositories/debtAccounts.ts apps/app/local-db/repositories/__tests__/debtAccounts.test.ts
git commit -m "feat(frontend): add debt account listing repository"
```

---

### Task 2: Debt Creation and Edit Validation

**Files:**
- Modify: `apps/app/local-db/repositories/debtAccounts.ts`
- Modify: `apps/app/local-db/repositories/__tests__/debtAccounts.test.ts`

**Interfaces:**
- Consumes: Task 1 `DebtAccount`, `DebtTypePreset`, `DebtPresetData`.
- Produces:
  - `CreateDebtAccountInput`
  - `UpdateDebtAccountInput`
  - `createDebtAccount(userId: string, deviceId: string, input: CreateDebtAccountInput): Promise<{ debt: DebtAccount; operation: SyncOperation }>`
  - `updateDebtAccount(userId: string, deviceId: string, id: string, input: UpdateDebtAccountInput): Promise<{ debt: DebtAccount; operation: SyncOperation }>`

- [ ] **Step 1: Add failing validation and create tests**

Append these tests inside the existing `describe` block in `apps/app/local-db/repositories/__tests__/debtAccounts.test.ts`:

```ts
  test("createDebtAccount rejects missing required common fields", async () => {
    const db = createDbMock();
    mockInitDatabase.mockResolvedValue(db);
    const { createDebtAccount } = await import("../debtAccounts");

    await expect(createDebtAccount("user-1", "device-1", {
      type: "personal_loan",
      name: "",
      lenderName: "Bank A",
      originalBalanceCentavos: 100000,
      currentBalanceCentavos: 100000,
      annualInterestRateBps: 0,
      minimumPaymentCentavos: 10000,
      paymentFrequency: "monthly",
      startDate: "2026-09-01",
      nextDueDate: "2026-10-01",
      interestPeriod: "annual",
      interestMethod: "no_interest",
      typeSpecific: { startDate: "2026-09-01", feesCentavos: 0, penaltyInfo: null, termMonths: null },
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: "debt name is required" });

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockEnqueueOperation).not.toHaveBeenCalled();
  });

  test("createDebtAccount inserts an active debt with no payment history", async () => {
    const insertedRow = { ...baseDebtRow, preset_key: "personal_loan", name: "Emergency loan" };
    const db = createDbMock({
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM debt_accounts WHERE id = ?")) return insertedRow;
        return null;
      }),
    });
    mockInitDatabase.mockResolvedValue(db);
    const { createDebtAccount } = await import("../debtAccounts");

    const result = await createDebtAccount("user-1", "device-1", {
      type: "personal_loan",
      name: " Emergency loan ",
      lenderName: "Bank A",
      originalBalanceCentavos: 100000,
      currentBalanceCentavos: 100000,
      annualInterestRateBps: 0,
      minimumPaymentCentavos: 10000,
      paymentFrequency: "monthly",
      startDate: "2026-09-01",
      nextDueDate: "2026-10-01",
      maturityDate: "2027-09-01",
      targetPayoffDate: null,
      interestPeriod: "annual",
      interestMethod: "no_interest",
      notes: "No payments yet",
      typeSpecific: {
        startDate: "2026-09-01",
        feesCentavos: 0,
        penaltyInfo: null,
        termMonths: 12,
        personalLoan: { purpose: "emergency" },
      },
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO debt_accounts"),
      "debt-1",
      "user-1",
      null,
      "Emergency loan",
      "Bank A",
      "personal_loan",
      "active",
      100000,
      100000,
      0,
      10000,
      "monthly",
      "2026-10-01",
      "2027-09-01",
      null,
      "annual",
      "no_interest",
      expect.stringContaining("emergency"),
      "No payments yet",
      expect.any(String),
      expect.any(String),
    );
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: "user-1",
      deviceId: "device-1",
      entity: "debt_accounts",
      recordId: "debt-1",
      operationType: "create",
      payload: expect.objectContaining({ name: "Emergency loan", preset_key: "personal_loan", status: "active" }),
    }));
    expect(result.debt.hasPaymentHistory).toBe(false);
  });

  test("createDebtAccount rejects salary loan payroll deduction without deduction details", async () => {
    const db = createDbMock();
    mockInitDatabase.mockResolvedValue(db);
    const { createDebtAccount } = await import("../debtAccounts");

    await expect(createDebtAccount("user-1", "device-1", {
      type: "salary_loan",
      name: "SSS salary loan",
      lenderName: "SSS",
      originalBalanceCentavos: 200000,
      currentBalanceCentavos: 200000,
      annualInterestRateBps: 1000,
      minimumPaymentCentavos: 10000,
      paymentFrequency: "monthly",
      startDate: "2026-09-01",
      nextDueDate: "2026-10-01",
      interestPeriod: "annual",
      interestMethod: "diminishing_balance",
      typeSpecific: {
        startDate: "2026-09-01",
        feesCentavos: 0,
        penaltyInfo: null,
        termMonths: 24,
        salaryLoan: {
          linkedIncomeSourceId: "income-1",
          repaymentMethod: "payroll_deduction",
          deductionAmountCentavos: null,
          deductionSchedule: null,
        },
      },
    })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "salary loan payroll deduction requires deduction amount and deduction schedule",
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --dir apps/app test -- debtAccounts.test.ts --runInBand
```

Expected: FAIL because create/update functions do not exist.

- [ ] **Step 3: Implement create/update validation and sync payloads**

Add these imports and types to `apps/app/local-db/repositories/debtAccounts.ts`:

```ts
import { enqueueOperation, LocalDbError } from "../helpers";
import { randomUUID } from "../uuid";
import type { SyncOperation } from "../types";

export type CreateDebtAccountInput = {
  type: DebtTypePreset;
  name: string;
  lenderName: string | null;
  linkedAccountId?: string | null;
  originalBalanceCentavos: number;
  currentBalanceCentavos: number;
  annualInterestRateBps: number;
  minimumPaymentCentavos: number;
  paymentFrequency: PaymentFrequency;
  startDate: string;
  nextDueDate: string;
  maturityDate?: string | null;
  targetPayoffDate?: string | null;
  interestPeriod: InterestRatePeriod | null;
  interestMethod: InterestMethod | null;
  notes?: string | null;
  typeSpecific: DebtPresetData;
};

export type UpdateDebtAccountInput = Partial<CreateDebtAccountInput>;
```

Add these helpers and functions:

```ts
function now(): string {
  return new Date().toISOString();
}

function assertWholeNumber(value: number, field: string, allowZero = true): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new LocalDbError("VALIDATION_ERROR", `${field} must be a ${allowZero ? "non-negative" : "positive"} whole number`);
  }
}

function assertIsoDate(value: string | null | undefined, field: string, required: boolean): void {
  if (!value) {
    if (required) throw new LocalDbError("VALIDATION_ERROR", `${field} is required`);
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new LocalDbError("VALIDATION_ERROR", `${field} must use YYYY-MM-DD format`);
  }
}

function validateTypeSpecific(type: DebtTypePreset, data: DebtPresetData): void {
  assertWholeNumber(data.feesCentavos ?? 0, "feesCentavos");
  if (data.termMonths != null) assertWholeNumber(data.termMonths, "termMonths", false);

  if (type === "salary_loan") {
    const salary = data.salaryLoan;
    if (!salary?.linkedIncomeSourceId) throw new LocalDbError("VALIDATION_ERROR", "salary loan requires a linked income source");
    if (!salary.repaymentMethod) throw new LocalDbError("VALIDATION_ERROR", "salary loan requires a repayment method");
    if (salary.repaymentMethod === "payroll_deduction") {
      if (!salary.deductionAmountCentavos || !salary.deductionSchedule) {
        throw new LocalDbError("VALIDATION_ERROR", "salary loan payroll deduction requires deduction amount and deduction schedule");
      }
      assertWholeNumber(salary.deductionAmountCentavos, "deductionAmountCentavos", false);
    }
  }

  if (type === "auto_loan") {
    const auto = data.autoLoan;
    if (!auto?.vehicleDescription?.trim()) throw new LocalDbError("VALIDATION_ERROR", "auto loan requires a vehicle description");
    if (auto.vehiclePurchasePriceCentavos != null) assertWholeNumber(auto.vehiclePurchasePriceCentavos, "vehiclePurchasePriceCentavos");
    if (auto.downpaymentCentavos != null) assertWholeNumber(auto.downpaymentCentavos, "downpaymentCentavos");
    if (auto.vehiclePurchasePriceCentavos != null && auto.downpaymentCentavos != null && auto.downpaymentCentavos > auto.vehiclePurchasePriceCentavos) {
      throw new LocalDbError("VALIDATION_ERROR", "auto loan downpayment cannot exceed vehicle purchase price");
    }
  }
}

function validateCreateInput(input: CreateDebtAccountInput): CreateDebtAccountInput {
  const name = input.name.trim();
  if (!name) throw new LocalDbError("VALIDATION_ERROR", "debt name is required");
  if (!DEBT_TYPES.includes(input.type)) throw new LocalDbError("VALIDATION_ERROR", "debt type is required");
  if (!input.lenderName?.trim()) throw new LocalDbError("VALIDATION_ERROR", "lender or provider is required");
  assertWholeNumber(input.originalBalanceCentavos, "originalBalanceCentavos", false);
  assertWholeNumber(input.currentBalanceCentavos, "currentBalanceCentavos");
  if (input.currentBalanceCentavos > input.originalBalanceCentavos) throw new LocalDbError("VALIDATION_ERROR", "current balance cannot exceed original balance");
  assertWholeNumber(input.annualInterestRateBps, "annualInterestRateBps");
  assertWholeNumber(input.minimumPaymentCentavos, "minimumPaymentCentavos", false);
  assertIsoDate(input.startDate, "start date", true);
  assertIsoDate(input.nextDueDate, "first or next payment date", true);
  assertIsoDate(input.maturityDate, "maturity date", false);
  assertIsoDate(input.targetPayoffDate, "target payoff date", false);
  if (!input.interestMethod) throw new LocalDbError("VALIDATION_ERROR", "interest method is required");
  validateTypeSpecific(input.type, input.typeSpecific);
  return { ...input, name, lenderName: input.lenderName.trim() };
}

function toPayload(input: CreateDebtAccountInput): Record<string, unknown> {
  return {
    linked_account_id: input.linkedAccountId ?? null,
    name: input.name.trim(),
    lender_name: input.lenderName?.trim() ?? null,
    preset_key: input.type,
    status: "active",
    original_balance_centavos: input.originalBalanceCentavos,
    current_balance_centavos: input.currentBalanceCentavos,
    annual_interest_rate_bps: input.annualInterestRateBps,
    minimum_payment_centavos: input.minimumPaymentCentavos,
    payment_frequency: input.paymentFrequency,
    next_due_date: input.nextDueDate,
    maturity_date: input.maturityDate ?? null,
    target_payoff_date: input.targetPayoffDate ?? null,
    interest_period: input.interestPeriod,
    interest_method: input.interestMethod,
    preset_data: JSON.stringify({ ...input.typeSpecific, startDate: input.startDate }),
    notes: input.notes ?? null,
  };
}

export async function createDebtAccount(userId: string, deviceId: string, input: CreateDebtAccountInput): Promise<{ debt: DebtAccount; operation: SyncOperation }> {
  const valid = validateCreateInput(input);
  const db = await getDb();
  const id = randomUUID();
  const ts = now();
  const payload = toPayload(valid);
  let result!: { debt: DebtAccount; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO debt_accounts
        (id, user_id, linked_account_id, name, lender_name, preset_key, status,
         original_balance_centavos, current_balance_centavos, annual_interest_rate_bps,
         minimum_payment_centavos, payment_frequency, next_due_date, maturity_date,
         target_payoff_date, interest_period, interest_method, preset_data, notes,
         version, deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      id,
      userId,
      payload.linked_account_id as string | null,
      payload.name as string,
      payload.lender_name as string | null,
      payload.preset_key as string,
      payload.status as string,
      payload.original_balance_centavos as number,
      payload.current_balance_centavos as number,
      payload.annual_interest_rate_bps as number,
      payload.minimum_payment_centavos as number,
      payload.payment_frequency as string,
      payload.next_due_date as string,
      payload.maturity_date as string | null,
      payload.target_payoff_date as string | null,
      payload.interest_period as string | null,
      payload.interest_method as string | null,
      payload.preset_data as string,
      payload.notes as string | null,
      ts,
      ts,
    );

    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "debt_accounts",
      recordId: id,
      operationType: "create",
      baseVersion: null,
      changedFields: Object.keys(payload),
      payload,
      failureMessage: `This debt "${valid.name}" could not be created.`,
    });

    const row = await db.getFirstAsync<DebtAccountRow>("SELECT * FROM debt_accounts WHERE id = ? AND user_id = ?", id, userId);
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "Failed to read created debt account");
    result = { debt: mapDebt(row), operation };
  });

  return result;
}
```

Implement `updateDebtAccount` with the same validation strategy: read the current row by `user_id` and `id`, merge current values with `input`, validate the merged object, update only changed fields, increment version, enqueue `operationType: "update"`, and reread the row. Use `changedFields` from payload keys actually present in the update.

- [ ] **Step 4: Run repository tests**

Run:

```bash
pnpm --dir apps/app test -- debtAccounts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/local-db/repositories/debtAccounts.ts apps/app/local-db/repositories/__tests__/debtAccounts.test.ts
git commit -m "feat(frontend): create non-credit-card debts"
```

---

### Task 3: Archive, Delete, and Status Defaults

**Files:**
- Modify: `apps/app/local-db/repositories/debtAccounts.ts`
- Modify: `apps/app/local-db/repositories/__tests__/debtAccounts.test.ts`

**Interfaces:**
- Consumes: Task 2 repository.
- Produces:
  - `archiveDebtAccount(userId: string, deviceId: string, id: string): Promise<{ debt: DebtAccount; operation: SyncOperation }>`
  - `markDebtAccountDeleted(userId: string, deviceId: string, id: string): Promise<{ operation: SyncOperation }>`

- [ ] **Step 1: Add failing archive/delete tests**

Append:

```ts
  test("archiveDebtAccount marks debt archived and keeps history", async () => {
    const archivedRow = { ...baseDebtRow, status: "archived", archived_at: "2026-09-07T00:00:00.000Z", version: 2 };
    const db = createDbMock({
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes("deleted = 0")) return baseDebtRow;
        if (sql.includes("SELECT * FROM debt_accounts WHERE id = ?")) return archivedRow;
        return null;
      }),
    });
    mockInitDatabase.mockResolvedValue(db);
    const { archiveDebtAccount } = await import("../debtAccounts");

    const result = await archiveDebtAccount("user-1", "device-1", "debt-1");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'archived'"),
      expect.any(String),
      "debt-1",
      "user-1",
    );
    expect(result.debt.status).toBe("archived");
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      entity: "debt_accounts",
      operationType: "update",
      payload: expect.objectContaining({ status: "archived" }),
    }));
  });

  test("markDebtAccountDeleted soft deletes the debt for sync and audit", async () => {
    const db = createDbMock({ getFirstAsync: jest.fn(async () => baseDebtRow) });
    mockInitDatabase.mockResolvedValue(db);
    const { markDebtAccountDeleted } = await import("../debtAccounts");

    await markDebtAccountDeleted("user-1", "device-1", "debt-1");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("deleted = 1"),
      expect.any(String),
      "debt-1",
      "user-1",
    );
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      entity: "debt_accounts",
      operationType: "delete",
      recordId: "debt-1",
    }));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --dir apps/app test -- debtAccounts.test.ts --runInBand
```

Expected: FAIL because archive/delete functions do not exist.

- [ ] **Step 3: Implement archive/delete functions**

Add:

```ts
async function requireActiveDebt(db: SQLite.SQLiteDatabase, userId: string, id: string): Promise<DebtAccountRow> {
  const row = await db.getFirstAsync<DebtAccountRow>(
    "SELECT * FROM debt_accounts WHERE user_id = ? AND id = ? AND deleted = 0",
    userId,
    id,
  );
  if (!row) throw new LocalDbError("NOT_FOUND", "Debt not found");
  return row;
}

export async function archiveDebtAccount(userId: string, deviceId: string, id: string): Promise<{ debt: DebtAccount; operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();
  let result!: { debt: DebtAccount; operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await requireActiveDebt(db, userId, id);
    const nextVersion = current.version + 1;
    await db.runAsync(
      "UPDATE debt_accounts SET status = 'archived', archived_at = COALESCE(archived_at, ?), version = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      ts,
      nextVersion,
      ts,
      id,
      userId,
    );
    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "debt_accounts",
      recordId: id,
      operationType: "update",
      baseVersion: current.version,
      changedFields: ["status", "archived_at"],
      payload: { status: "archived", archived_at: ts },
      failureMessage: `This debt "${current.name}" could not be archived.`,
    });
    const row = await db.getFirstAsync<DebtAccountRow>("SELECT * FROM debt_accounts WHERE id = ? AND user_id = ?", id, userId);
    if (!row) throw new LocalDbError("INTERNAL_ERROR", "Failed to read archived debt account");
    result = { debt: mapDebt(row), operation };
  });

  return result;
}

export async function markDebtAccountDeleted(userId: string, deviceId: string, id: string): Promise<{ operation: SyncOperation }> {
  const db = await getDb();
  const ts = now();
  let result!: { operation: SyncOperation };

  await db.withTransactionAsync(async () => {
    const current = await requireActiveDebt(db, userId, id);
    await db.runAsync(
      "UPDATE debt_accounts SET status = 'deleted', deleted = 1, version = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      current.version + 1,
      ts,
      id,
      userId,
    );
    const operation = await enqueueOperation(db, {
      userId,
      deviceId,
      entity: "debt_accounts",
      recordId: id,
      operationType: "delete",
      baseVersion: current.version,
      changedFields: ["status", "deleted"],
      payload: { status: "deleted", deleted: true },
      failureMessage: `This debt "${current.name}" could not be deleted.`,
    });
    result = { operation };
  });

  return result;
}
```

- [ ] **Step 4: Run repository tests**

```bash
pnpm --dir apps/app test -- debtAccounts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/local-db/repositories/debtAccounts.ts apps/app/local-db/repositories/__tests__/debtAccounts.test.ts
git commit -m "feat(frontend): archive and delete debts"
```

---

### Task 4: Debt Type Constants and Form Copy

**Files:**
- Create: `apps/app/features/debt-manager/debtTypes.ts`

**Interfaces:**
- Consumes: feature module copy from sections 7.14, 7.15, 7.15.1, and 7.22.
- Produces:
  - `DEBT_TYPE_OPTIONS`
  - `PAYMENT_FREQUENCY_OPTIONS`
  - `INTEREST_METHOD_OPTIONS`
  - `INTEREST_PERIOD_OPTIONS`
  - `DEBT_PLACEHOLDERS`
  - `getDebtTypeLabel(type: DebtTypePreset): string`

- [ ] **Step 1: Create constants file**

Create `apps/app/features/debt-manager/debtTypes.ts`:

```ts
import type { DebtTypePreset, InterestMethod, InterestRatePeriod, PaymentFrequency } from "../../local-db/repositories/debtAccounts";

export const DEBT_TYPE_OPTIONS: Array<{ value: DebtTypePreset; label: string }> = [
  { value: "personal_loan", label: "Personal Loan" },
  { value: "salary_loan", label: "Salary Loan" },
  { value: "multipurpose_loan", label: "Multipurpose Loan" },
  { value: "business_loan", label: "Business Loan" },
  { value: "auto_loan", label: "Auto Loan" },
  { value: "custom_debt", label: "Custom Debt" },
];

export const PAYMENT_FREQUENCY_OPTIONS: Array<{ value: PaymentFrequency; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "semi_monthly", label: "Semi-monthly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "custom", label: "Custom" },
];

export const INTEREST_METHOD_OPTIONS: Array<{ value: InterestMethod; label: string }> = [
  { value: "flat_add_on", label: "Flat or Add-on" },
  { value: "diminishing_balance", label: "Diminishing Balance" },
  { value: "provider_calculated", label: "Provider Calculated" },
  { value: "no_interest", label: "No Interest" },
];

export const INTEREST_PERIOD_OPTIONS: Array<{ value: InterestRatePeriod; label: string }> = [
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly" },
  { value: "per_term", label: "Per term" },
  { value: "none", label: "None" },
];

export const DEBT_PLACEHOLDERS = {
  debtType: "Select debt type",
  debtName: "Enter debt name",
  lenderName: "Enter lender name",
  originalAmount: "Enter original amount",
  currentBalance: "Enter current balance",
  startDate: "Select start date",
  maturityDate: "Select maturity date",
  interestRate: "Enter interest rate",
  interestRatePeriod: "Select interest rate period",
  interestMethod: "Select interest method",
  paymentAmount: "Enter payment amount",
  paymentFrequency: "Select payment frequency",
  nextPaymentDate: "Select payment date",
  targetPayoffDate: "Select target payoff date",
  debtSpecificTerm: "Enter loan or installment term",
  notes: "Add notes",
  personalLoanPurpose: "Select loan purpose",
  salaryLinkedIncomeSource: "Select linked income source",
  salaryRepaymentMethod: "Select repayment method",
  salaryDeductionAmount: "Enter deduction amount",
  salaryDeductionSchedule: "Select deduction schedule",
  multipurposeLoanPurpose: "Select loan purpose or purposes",
  businessLoanSource: "Select linked business or income source",
  businessLoanPurpose: "Select business loan purpose",
  autoVehicleDescription: "Enter vehicle description",
  autoPurchasePrice: "Enter vehicle purchase price",
  autoDownpayment: "Enter downpayment",
  customDebtInterestMethod: "Select interest method",
} as const;

export function getDebtTypeLabel(type: DebtTypePreset): string {
  return DEBT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Custom Debt";
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm --dir apps/app exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/app/features/debt-manager/debtTypes.ts
git commit -m "feat(frontend): add debt type form constants"
```

---

### Task 5: Non-Credit-Card Debt Form UI

**Files:**
- Create: `apps/app/features/debt-manager/NonCreditDebtForm.tsx`
- Create: `apps/app/features/debt-manager/__tests__/NonCreditDebtForm.test.tsx`

**Interfaces:**
- Consumes: `CreateDebtAccountInput`, `DebtAccount`, `createDebtAccount`, `updateDebtAccount`, constants from Task 4.
- Produces: `NonCreditDebtForm` component.

```ts
export type NonCreditDebtFormProps = {
  userId: string;
  deviceId: string;
  debt?: DebtAccount | null;
  onCancel: () => void;
  onSaved: (debt: DebtAccount) => void;
};
```

- [ ] **Step 1: Write failing form tests**

Create `apps/app/features/debt-manager/__tests__/NonCreditDebtForm.test.tsx`:

```tsx
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import NonCreditDebtForm from "../NonCreditDebtForm";

const mockCreateDebtAccount = jest.fn();
const mockUpdateDebtAccount = jest.fn();

jest.mock("../../../local-db/repositories/debtAccounts", () => ({
  createDebtAccount: (...args: any[]) => mockCreateDebtAccount(...args),
  updateDebtAccount: (...args: any[]) => mockUpdateDebtAccount(...args),
}));

describe("NonCreditDebtForm", () => {
  beforeEach(() => {
    mockCreateDebtAccount.mockReset();
    mockUpdateDebtAccount.mockReset();
  });

  test("renders required placeholders from feature modules", () => {
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={jest.fn()} />);

    expect(view.getByPlaceholderText("Enter debt name")).toBeTruthy();
    expect(view.getByPlaceholderText("Enter lender name")).toBeTruthy();
    expect(view.getByPlaceholderText("Enter original amount")).toBeTruthy();
    expect(view.getByPlaceholderText("Enter current balance")).toBeTruthy();
    expect(view.getByPlaceholderText("Select start date")).toBeTruthy();
    expect(view.getByPlaceholderText("Select payment date")).toBeTruthy();
    expect(view.getByText("Personal Loan")).toBeTruthy();
    expect(view.getByText("Salary Loan")).toBeTruthy();
    expect(view.getByText("Multipurpose Loan")).toBeTruthy();
    expect(view.getByText("Business Loan")).toBeTruthy();
    expect(view.getByText("Auto Loan")).toBeTruthy();
    expect(view.getByText("Custom Debt")).toBeTruthy();
  });

  test("shows validation message when required fields are blank", async () => {
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={jest.fn()} />);

    fireEvent.press(view.getByText("Save debt"));

    expect(await view.findByText("Some debt details are not valid. Check the highlighted fields and try again.")).toBeTruthy();
    expect(mockCreateDebtAccount).not.toHaveBeenCalled();
  });

  test("creates a personal loan with no payment history", async () => {
    mockCreateDebtAccount.mockResolvedValue({ debt: { id: "debt-1", name: "Emergency loan" } });
    const onSaved = jest.fn();
    const view = render(<NonCreditDebtForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={onSaved} />);

    fireEvent.changeText(view.getByPlaceholderText("Enter debt name"), "Emergency loan");
    fireEvent.changeText(view.getByPlaceholderText("Enter lender name"), "Bank A");
    fireEvent.changeText(view.getByPlaceholderText("Enter original amount"), "1000");
    fireEvent.changeText(view.getByPlaceholderText("Enter current balance"), "1000");
    fireEvent.changeText(view.getByPlaceholderText("Enter payment amount"), "100");
    fireEvent.changeText(view.getByPlaceholderText("Select start date"), "2026-09-01");
    fireEvent.changeText(view.getByPlaceholderText("Select payment date"), "2026-10-01");
    fireEvent.press(view.getByText("Save debt"));

    await waitFor(() => expect(mockCreateDebtAccount).toHaveBeenCalledWith("user-1", "device-1", expect.objectContaining({
      type: "personal_loan",
      name: "Emergency loan",
      lenderName: "Bank A",
      originalBalanceCentavos: 100000,
      currentBalanceCentavos: 100000,
      minimumPaymentCentavos: 10000,
      typeSpecific: expect.objectContaining({ personalLoan: expect.any(Object) }),
    })));
    expect(onSaved).toHaveBeenCalledWith({ id: "debt-1", name: "Emergency loan" });
  });
});
```

- [ ] **Step 2: Run form tests to verify they fail**

```bash
pnpm --dir apps/app test -- NonCreditDebtForm.test.tsx --runInBand
```

Expected: FAIL because `NonCreditDebtForm` does not exist.

- [ ] **Step 3: Implement the form component**

Create `apps/app/features/debt-manager/NonCreditDebtForm.tsx` with controlled fields for:

```tsx
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  createDebtAccount,
  updateDebtAccount,
  type CreateDebtAccountInput,
  type DebtAccount,
  type DebtTypePreset,
  type InterestMethod,
  type InterestRatePeriod,
  type PaymentFrequency,
} from "../../local-db/repositories/debtAccounts";
import {
  DEBT_PLACEHOLDERS,
  DEBT_TYPE_OPTIONS,
  INTEREST_METHOD_OPTIONS,
  INTEREST_PERIOD_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
} from "./debtTypes";

export type NonCreditDebtFormProps = {
  userId: string;
  deviceId: string;
  debt?: DebtAccount | null;
  onCancel: () => void;
  onSaved: (debt: DebtAccount) => void;
};

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", danger: "#B42318" } as const;

function centavosFromPesoText(value: string): number {
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed * 100);
}

function pesoText(value: number | null | undefined): string {
  if (!value) return "";
  return String(value / 100);
}

function OptionRow<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {options.map((option) => (
      <Pressable key={option.value} accessibilityRole="button" onPress={() => onChange(option.value)} style={{ borderWidth: 1, borderColor: value === option.value ? P.brand : P.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: value === option.value ? P.brand : P.ink, fontFamily: "Manrope", fontWeight: "700", fontSize: 12 }}>{option.label}</Text>
      </Pressable>
    ))}
  </View>;
}

export default function NonCreditDebtForm({ userId, deviceId, debt, onCancel, onSaved }: NonCreditDebtFormProps) {
  const [type, setType] = useState<DebtTypePreset>(debt?.type ?? "personal_loan");
  const [name, setName] = useState(debt?.name ?? "");
  const [lenderName, setLenderName] = useState(debt?.lenderName ?? "");
  const [originalAmount, setOriginalAmount] = useState(pesoText(debt?.originalBalanceCentavos));
  const [currentBalance, setCurrentBalance] = useState(pesoText(debt?.currentBalanceCentavos));
  const [interestRate, setInterestRate] = useState(debt ? String(debt.annualInterestRateBps / 100) : "0");
  const [minimumPayment, setMinimumPayment] = useState(pesoText(debt?.minimumPaymentCentavos));
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(debt?.paymentFrequency ?? "monthly");
  const [startDate, setStartDate] = useState(debt?.typeSpecific.startDate ?? "");
  const [nextDueDate, setNextDueDate] = useState(debt?.nextDueDate ?? "");
  const [maturityDate, setMaturityDate] = useState(debt?.maturityDate ?? "");
  const [targetPayoffDate, setTargetPayoffDate] = useState(debt?.targetPayoffDate ?? "");
  const [interestPeriod, setInterestPeriod] = useState<InterestRatePeriod>(debt?.interestPeriod ?? "annual");
  const [interestMethod, setInterestMethod] = useState<InterestMethod>(debt?.interestMethod ?? "no_interest");
  const [termMonths, setTermMonths] = useState(debt?.typeSpecific.termMonths ? String(debt.typeSpecific.termMonths) : "");
  const [fees, setFees] = useState(pesoText(debt?.typeSpecific.feesCentavos));
  const [penaltyInfo, setPenaltyInfo] = useState(debt?.typeSpecific.penaltyInfo ?? "");
  const [notes, setNotes] = useState(debt?.notes ?? "");
  const [personalPurpose, setPersonalPurpose] = useState(debt?.typeSpecific.personalLoan?.purpose ?? "");
  const [salaryIncomeSourceId, setSalaryIncomeSourceId] = useState(debt?.typeSpecific.salaryLoan?.linkedIncomeSourceId ?? "");
  const [salaryRepaymentMethod, setSalaryRepaymentMethod] = useState(debt?.typeSpecific.salaryLoan?.repaymentMethod ?? "manual_payment");
  const [salaryDeductionAmount, setSalaryDeductionAmount] = useState(pesoText(debt?.typeSpecific.salaryLoan?.deductionAmountCentavos));
  const [salaryDeductionSchedule, setSalaryDeductionSchedule] = useState<PaymentFrequency>(debt?.typeSpecific.salaryLoan?.deductionSchedule ?? "monthly");
  const [multipurposePurpose, setMultipurposePurpose] = useState("");
  const [businessSource, setBusinessSource] = useState(debt?.typeSpecific.businessLoan?.linkedBusinessOrIncomeSourceId ?? "");
  const [businessPurpose, setBusinessPurpose] = useState(debt?.typeSpecific.businessLoan?.purpose ?? "");
  const [vehicleDescription, setVehicleDescription] = useState(debt?.typeSpecific.autoLoan?.vehicleDescription ?? "");
  const [vehiclePrice, setVehiclePrice] = useState(pesoText(debt?.typeSpecific.autoLoan?.vehiclePurchasePriceCentavos));
  const [downpayment, setDownpayment] = useState(pesoText(debt?.typeSpecific.autoLoan?.downpaymentCentavos));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const financedPrincipal = useMemo(() => {
    const price = centavosFromPesoText(vehiclePrice || "0");
    const down = centavosFromPesoText(downpayment || "0");
    if (!Number.isFinite(price) || !Number.isFinite(down)) return null;
    return Math.max(price - down, 0);
  }, [vehiclePrice, downpayment]);

  function buildInput(): CreateDebtAccountInput | null {
    const originalBalanceCentavos = centavosFromPesoText(originalAmount);
    const currentBalanceCentavos = centavosFromPesoText(currentBalance);
    const minimumPaymentCentavos = centavosFromPesoText(minimumPayment);
    const feesCentavos = centavosFromPesoText(fees || "0");
    const annualInterestRateBps = Math.round(Number(interestRate || "0") * 100);
    if (!name.trim() || !lenderName.trim() || !Number.isFinite(originalBalanceCentavos) || !Number.isFinite(currentBalanceCentavos) || !Number.isFinite(minimumPaymentCentavos) || !startDate || !nextDueDate) return null;

    return {
      type,
      name,
      lenderName,
      originalBalanceCentavos,
      currentBalanceCentavos,
      annualInterestRateBps,
      minimumPaymentCentavos,
      paymentFrequency,
      startDate,
      nextDueDate,
      maturityDate: maturityDate || null,
      targetPayoffDate: targetPayoffDate || null,
      interestPeriod,
      interestMethod,
      notes: notes || null,
      typeSpecific: {
        startDate,
        feesCentavos: Number.isFinite(feesCentavos) ? feesCentavos : 0,
        penaltyInfo: penaltyInfo || null,
        termMonths: termMonths ? Number(termMonths) : null,
        personalLoan: type === "personal_loan" ? { purpose: personalPurpose || null } : undefined,
        salaryLoan: type === "salary_loan" ? { linkedIncomeSourceId: salaryIncomeSourceId || null, repaymentMethod: salaryRepaymentMethod, deductionAmountCentavos: salaryDeductionAmount ? centavosFromPesoText(salaryDeductionAmount) : null, deductionSchedule: salaryDeductionSchedule } : undefined,
        multipurposeLoan: type === "multipurpose_loan" ? { purposes: multipurposePurpose ? [multipurposePurpose] : [] } : undefined,
        businessLoan: type === "business_loan" ? { linkedBusinessOrIncomeSourceId: businessSource || null, purpose: businessPurpose || null } : undefined,
        autoLoan: type === "auto_loan" ? { vehicleDescription: vehicleDescription || null, vehiclePurchasePriceCentavos: vehiclePrice ? centavosFromPesoText(vehiclePrice) : null, downpaymentCentavos: downpayment ? centavosFromPesoText(downpayment) : null, financedPrincipalCentavos: financedPrincipal } : undefined,
        customDebt: type === "custom_debt" ? { providerCalculatedInterest: interestMethod === "provider_calculated" } : undefined,
      },
    };
  }

  async function save() {
    setMessage(null);
    const input = buildInput();
    if (!input) {
      setMessage("Some debt details are not valid. Check the highlighted fields and try again.");
      return;
    }
    setSaving(true);
    try {
      const result = debt ? await updateDebtAccount(userId, deviceId, debt.id, input) : await createDebtAccount(userId, deviceId, input);
      onSaved(result.debt);
    } catch {
      setMessage("Your debt information could not be loaded or saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return <ScrollView contentContainerStyle={{ gap: 12 }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>{debt ? "Edit debt" : "Create debt"}</Text>
    <OptionRow options={DEBT_TYPE_OPTIONS} value={type} onChange={setType} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.debtName} value={name} onChangeText={setName} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.lenderName} value={lenderName} onChangeText={setLenderName} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.originalAmount} value={originalAmount} onChangeText={setOriginalAmount} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.currentBalance} value={currentBalance} onChangeText={setCurrentBalance} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.interestRate} value={interestRate} onChangeText={setInterestRate} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <OptionRow options={INTEREST_PERIOD_OPTIONS} value={interestPeriod} onChange={setInterestPeriod} />
    <OptionRow options={INTEREST_METHOD_OPTIONS} value={interestMethod} onChange={setInterestMethod} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.paymentAmount} value={minimumPayment} onChangeText={setMinimumPayment} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <OptionRow options={PAYMENT_FREQUENCY_OPTIONS} value={paymentFrequency} onChange={setPaymentFrequency} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.startDate} value={startDate} onChangeText={setStartDate} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.nextPaymentDate} value={nextDueDate} onChangeText={setNextDueDate} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.maturityDate} value={maturityDate} onChangeText={setMaturityDate} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.targetPayoffDate} value={targetPayoffDate} onChangeText={setTargetPayoffDate} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.debtSpecificTerm} value={termMonths} onChangeText={setTermMonths} keyboardType="number-pad" style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    {type === "personal_loan" ? <TextInput placeholder={DEBT_PLACEHOLDERS.personalLoanPurpose} value={personalPurpose} onChangeText={setPersonalPurpose} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /> : null}
    {type === "salary_loan" ? <View style={{ gap: 12 }}><TextInput placeholder={DEBT_PLACEHOLDERS.salaryLinkedIncomeSource} value={salaryIncomeSourceId} onChangeText={setSalaryIncomeSourceId} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /><TextInput placeholder={DEBT_PLACEHOLDERS.salaryRepaymentMethod} value={salaryRepaymentMethod} onChangeText={setSalaryRepaymentMethod as any} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /><TextInput placeholder={DEBT_PLACEHOLDERS.salaryDeductionAmount} value={salaryDeductionAmount} onChangeText={setSalaryDeductionAmount} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /></View> : null}
    {type === "multipurpose_loan" ? <TextInput placeholder={DEBT_PLACEHOLDERS.multipurposeLoanPurpose} value={multipurposePurpose} onChangeText={setMultipurposePurpose} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /> : null}
    {type === "business_loan" ? <View style={{ gap: 12 }}><TextInput placeholder={DEBT_PLACEHOLDERS.businessLoanSource} value={businessSource} onChangeText={setBusinessSource} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /><TextInput placeholder={DEBT_PLACEHOLDERS.businessLoanPurpose} value={businessPurpose} onChangeText={setBusinessPurpose} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /></View> : null}
    {type === "auto_loan" ? <View style={{ gap: 12 }}><TextInput placeholder={DEBT_PLACEHOLDERS.autoVehicleDescription} value={vehicleDescription} onChangeText={setVehicleDescription} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /><TextInput placeholder={DEBT_PLACEHOLDERS.autoPurchasePrice} value={vehiclePrice} onChangeText={setVehiclePrice} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /><TextInput placeholder={DEBT_PLACEHOLDERS.autoDownpayment} value={downpayment} onChangeText={setDownpayment} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} /></View> : null}
    <TextInput placeholder="Enter fees" value={fees} onChangeText={setFees} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder="Enter penalty information" value={penaltyInfo} onChangeText={setPenaltyInfo} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    <TextInput placeholder={DEBT_PLACEHOLDERS.notes} value={notes} onChangeText={setNotes} multiline style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 10 }} />
    {message ? <Text style={{ color: P.danger, fontFamily: "Manrope", fontSize: 12 }}>{message}</Text> : null}
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Pressable accessibilityRole="button" onPress={save} disabled={saving} style={{ backgroundColor: P.brand, borderRadius: 12, padding: 12 }}><Text style={{ color: "white", fontWeight: "800" }}>{saving ? "Saving..." : "Save debt"}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onCancel} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 12 }}><Text>Cancel</Text></Pressable>
    </View>
  </ScrollView>;
}
```

- [ ] **Step 4: Run form tests**

```bash
pnpm --dir apps/app test -- NonCreditDebtForm.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/features/debt-manager/NonCreditDebtForm.tsx apps/app/features/debt-manager/__tests__/NonCreditDebtForm.test.tsx
git commit -m "feat(frontend): add non-credit-card debt form"
```

---

### Task 6: Debt List and Detail UI

**Files:**
- Create: `apps/app/features/debt-manager/NonCreditDebtList.tsx`
- Create: `apps/app/features/debt-manager/NonCreditDebtDetail.tsx`
- Create: `apps/app/features/debt-manager/__tests__/DebtManagerOverview.nonCreditDebts.test.tsx`

**Interfaces:**
- Consumes: `DebtAccount`, `archiveDebtAccount`, `markDebtAccountDeleted`, `getDebtTypeLabel`.
- Produces:
  - `NonCreditDebtList`
  - `NonCreditDebtDetail`

- [ ] **Step 1: Write failing UI tests**

Create `apps/app/features/debt-manager/__tests__/DebtManagerOverview.nonCreditDebts.test.tsx`:

```tsx
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import DebtManagerOverview from "../DebtManagerOverview";

const mockListFinancialAccounts = jest.fn();
const mockListDebtAccounts = jest.fn();
const mockArchiveDebtAccount = jest.fn();
const mockMarkDebtAccountDeleted = jest.fn();

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listFinancialAccounts: (...args: any[]) => mockListFinancialAccounts(...args),
}));

jest.mock("../../../local-db/repositories/debtAccounts", () => ({
  listDebtAccounts: (...args: any[]) => mockListDebtAccounts(...args),
  archiveDebtAccount: (...args: any[]) => mockArchiveDebtAccount(...args),
  markDebtAccountDeleted: (...args: any[]) => mockMarkDebtAccountDeleted(...args),
}));

const debt = {
  id: "debt-1",
  name: "Car loan",
  lenderName: "Bank A",
  type: "auto_loan",
  status: "active",
  progress: "no_payments",
  originalBalanceCentavos: 50000000,
  currentBalanceCentavos: 45000000,
  annualInterestRateBps: 650,
  minimumPaymentCentavos: 1500000,
  paymentFrequency: "monthly",
  nextDueDate: "2026-10-01",
  maturityDate: "2030-10-01",
  targetPayoffDate: null,
  interestPeriod: "annual",
  interestMethod: "diminishing_balance",
  notes: null,
  typeSpecific: { startDate: "2026-01-01", feesCentavos: 0, penaltyInfo: null, termMonths: 48 },
  hasPaymentHistory: false,
  archivedAt: null,
  paidOffAt: null,
  version: 1,
};

describe("DebtManagerOverview non-credit-card debts", () => {
  beforeEach(() => {
    mockListFinancialAccounts.mockReset();
    mockListDebtAccounts.mockReset();
    mockArchiveDebtAccount.mockReset();
    mockMarkDebtAccountDeleted.mockReset();
    mockListFinancialAccounts.mockResolvedValue([]);
    mockListDebtAccounts.mockResolvedValue([debt]);
  });

  test("shows non-credit-card debts separately from credit cards", async () => {
    const view = render(<DebtManagerOverview userId="user-1" deviceId="device-1" onOpenCreditCards={jest.fn()} /> as any);

    expect(await view.findByText("Non-credit-card debts")).toBeTruthy();
    expect(view.getByText("Car loan")).toBeTruthy();
    expect(view.getByText("Auto Loan"));
    expect(view.getByText("No payments recorded yet."));
  });

  test("archives debt after confirmation action", async () => {
    mockArchiveDebtAccount.mockResolvedValue({ debt: { ...debt, status: "archived" } });
    const view = render(<DebtManagerOverview userId="user-1" deviceId="device-1" onOpenCreditCards={jest.fn()} /> as any);

    fireEvent.press(await view.findByText("Car loan"));
    fireEvent.press(view.getByText("Archive debt"));
    fireEvent.press(view.getByText("Confirm archive"));

    await waitFor(() => expect(mockArchiveDebtAccount).toHaveBeenCalledWith("user-1", "device-1", "debt-1"));
  });
});
```

- [ ] **Step 2: Run UI tests to verify they fail**

```bash
pnpm --dir apps/app test -- DebtManagerOverview.nonCreditDebts.test.tsx --runInBand
```

Expected: FAIL because overview does not load debts and components do not exist.

- [ ] **Step 3: Implement `NonCreditDebtList`**

Create `apps/app/features/debt-manager/NonCreditDebtList.tsx`:

```tsx
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { DebtAccount } from "../../local-db/repositories/debtAccounts";
import { getDebtTypeLabel } from "./debtTypes";

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;

function formatMoney(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function progressLabel(debt: DebtAccount): string {
  if (!debt.hasPaymentHistory || debt.progress === "no_payments") return "No payments recorded yet.";
  if (debt.progress === "behind") return "Behind";
  if (debt.progress === "ahead") return "Ahead";
  if (debt.progress === "finished") return "Finished";
  return "On Schedule";
}

export default function NonCreditDebtList({ debts, selectedDebtId, onSelectDebt }: { debts: DebtAccount[]; selectedDebtId: string | null; onSelectDebt: (debt: DebtAccount) => void }) {
  return <View style={{ marginTop: 18, gap: 10 }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>Non-credit-card debts</Text>
    {debts.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>No debts are recorded yet. Add a debt to track repayment progress.</Text> : debts.map((debt) => (
      <Pressable key={debt.id} accessibilityRole="button" onPress={() => onSelectDebt(debt)} style={{ borderWidth: 1, borderColor: selectedDebtId === debt.id ? P.brand : P.line, borderRadius: 16, padding: 14, backgroundColor: P.shell }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>{debt.name}</Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>{getDebtTypeLabel(debt.type)} • {debt.lenderName ?? "No lender"}</Text>
        <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 3 }}>Remaining balance: {formatMoney(debt.currentBalanceCentavos)}</Text>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.brand, marginTop: 6 }}>{progressLabel(debt)}</Text>
      </Pressable>
    ))}
  </View>;
}
```

- [ ] **Step 4: Implement `NonCreditDebtDetail`**

Create `apps/app/features/debt-manager/NonCreditDebtDetail.tsx`:

```tsx
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { archiveDebtAccount, markDebtAccountDeleted, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import { getDebtTypeLabel } from "./debtTypes";

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", danger: "#B42318" } as const;

function formatMoney(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function NonCreditDebtDetail({ userId, deviceId, debt, onEdit, onChanged }: { userId: string; deviceId: string; debt: DebtAccount; onEdit: (debt: DebtAccount) => void; onChanged: () => void }) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function archiveDebt() {
    setMessage(null);
    try {
      await archiveDebtAccount(userId, deviceId, debt.id);
      onChanged();
    } catch {
      setMessage("Your debt changes could not be completed. Review the debt details and try again.");
    }
  }

  async function deleteDebt() {
    setMessage(null);
    try {
      await markDebtAccountDeleted(userId, deviceId, debt.id);
      onChanged();
    } catch {
      setMessage("Your debt changes could not be completed. Review the debt details and try again.");
    }
  }

  return <View style={{ marginTop: 18, borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 16, gap: 8 }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: P.ink }}>{debt.name}</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>{getDebtTypeLabel(debt.type)} • {debt.status}</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>Current balance: {formatMoney(debt.currentBalanceCentavos)}</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>Original amount: {formatMoney(debt.originalBalanceCentavos)}</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>Required payment: {formatMoney(debt.minimumPaymentCentavos)} • {debt.paymentFrequency}</Text>
    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: P.brand }}>{debt.hasPaymentHistory ? "Payment history available." : "No payments recorded yet."}</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted }}>Active debt is included in current planning. Archived debt is retained but excluded from current planning.</Text>
    {message ? <Text style={{ color: P.danger, fontFamily: "Manrope", fontSize: 12 }}>{message}</Text> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      <Pressable accessibilityRole="button" onPress={() => onEdit(debt)} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 10, padding: 10 }}><Text>Edit debt</Text></Pressable>
      {confirmArchive ? <Pressable accessibilityRole="button" onPress={archiveDebt} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 10, padding: 10 }}><Text>Confirm archive</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => setConfirmArchive(true)} style={{ borderWidth: 1, borderColor: P.line, borderRadius: 10, padding: 10 }}><Text>Archive debt</Text></Pressable>}
      {confirmDelete ? <Pressable accessibilityRole="button" onPress={deleteDebt} style={{ borderWidth: 1, borderColor: P.danger, borderRadius: 10, padding: 10 }}><Text style={{ color: P.danger }}>Confirm delete</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ borderWidth: 1, borderColor: P.danger, borderRadius: 10, padding: 10 }}><Text style={{ color: P.danger }}>Delete debt</Text></Pressable>}
    </View>
  </View>;
}
```

- [ ] **Step 5: Run UI tests**

```bash
pnpm --dir apps/app test -- DebtManagerOverview.nonCreditDebts.test.tsx --runInBand
```

Expected: still FAIL until overview is wired in Task 7.

- [ ] **Step 6: Commit**

```bash
git add apps/app/features/debt-manager/NonCreditDebtList.tsx apps/app/features/debt-manager/NonCreditDebtDetail.tsx apps/app/features/debt-manager/__tests__/DebtManagerOverview.nonCreditDebts.test.tsx
git commit -m "feat(frontend): add debt list and detail components"
```

---

### Task 7: Wire Debt Creation Into Debt Manager Overview

**Files:**
- Modify: `apps/app/features/debt-manager/DebtManagerOverview.tsx`
- Modify: `apps/app/components/MobileShell.tsx` only if `DebtManagerOverview` props require `deviceId`.
- Modify: `apps/app/features/debt-manager/__tests__/DebtManagerOverview.nonCreditDebts.test.tsx`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: Debt Manager overview with non-credit-card debt list, create/edit form, and detail actions.

- [ ] **Step 1: Update `DebtManagerOverview` props**

Change props from:

```ts
type Props = { userId: string; onOpenCreditCards: () => void };
```

to:

```ts
type Props = { userId: string; deviceId: string; onOpenCreditCards: () => void };
```

- [ ] **Step 2: Wire loading and local state**

In `DebtManagerOverview.tsx`, import:

```ts
import { listDebtAccounts, type DebtAccount } from "../../local-db/repositories/debtAccounts";
import NonCreditDebtForm from "./NonCreditDebtForm";
import NonCreditDebtList from "./NonCreditDebtList";
import NonCreditDebtDetail from "./NonCreditDebtDetail";
```

Replace single credit-card-only state with:

```ts
const [cards, setCards] = useState<FinancialAccount[] | null>(null);
const [debts, setDebts] = useState<DebtAccount[] | null>(null);
const [selectedDebt, setSelectedDebt] = useState<DebtAccount | null>(null);
const [editingDebt, setEditingDebt] = useState<DebtAccount | null | undefined>(undefined);

async function load() {
  const [accounts, debtRows] = await Promise.all([
    listFinancialAccounts(userId),
    listDebtAccounts(userId, "active"),
  ]);
  setCards(accounts.filter((account) => account.kind === "credit_card" && account.status === "active"));
  setDebts(debtRows);
  setSelectedDebt((current) => current ? debtRows.find((debt) => debt.id === current.id) ?? null : debtRows[0] ?? null);
}

useEffect(() => {
  load().catch(() => {
    setCards([]);
    setDebts([]);
  });
}, [userId]);
```

- [ ] **Step 3: Render create/edit mode**

Before the main return, add:

```tsx
if (editingDebt !== undefined) {
  return <NonCreditDebtForm
    userId={userId}
    deviceId={deviceId}
    debt={editingDebt}
    onCancel={() => setEditingDebt(undefined)}
    onSaved={(debt) => {
      setEditingDebt(undefined);
      setSelectedDebt(debt);
      load().catch(() => {});
    }}
  />;
}
```

- [ ] **Step 4: Render non-credit-card debt section**

Under the Credit Cards card, add:

```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Add non-credit-card debt" onPress={() => setEditingDebt(null)} style={{ marginTop: 16, backgroundColor: P.brand, borderRadius: 14, padding: 12 }}>
  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: "white" }}>Add debt</Text>
</Pressable>
<NonCreditDebtList debts={debts ?? []} selectedDebtId={selectedDebt?.id ?? null} onSelectDebt={setSelectedDebt} />
{selectedDebt ? <NonCreditDebtDetail userId={userId} deviceId={deviceId} debt={selectedDebt} onEdit={setEditingDebt} onChanged={() => load().catch(() => {})} /> : null}
```

- [ ] **Step 5: Pass `deviceId` from `MobileShell`**

In `apps/app/components/MobileShell.tsx`, change:

```tsx
return <DebtManagerOverview userId={userId} onOpenCreditCards={() => setCurrentPage("credit-cards")} />;
```

to:

```tsx
return <DebtManagerOverview userId={userId} deviceId={deviceId} onOpenCreditCards={() => setCurrentPage("credit-cards")} />;
```

- [ ] **Step 6: Run overview tests**

```bash
pnpm --dir apps/app test -- DebtManagerOverview.nonCreditDebts.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Run existing debt manager tests to catch credit-card regressions**

```bash
pnpm --dir apps/app test -- DebtManagerScreen.test.tsx --runInBand
```

Expected: PASS. The Credit Card module still loads from `DebtManagerScreen` and remains separate.

- [ ] **Step 8: Commit**

```bash
git add apps/app/features/debt-manager/DebtManagerOverview.tsx apps/app/components/MobileShell.tsx apps/app/features/debt-manager/__tests__/DebtManagerOverview.nonCreditDebts.test.tsx
git commit -m "feat(frontend): wire non-credit-card debt creation"
```

---

### Task 8: Sync Payload Compatibility Check

**Files:**
- Read: `supabase/migrations/20260822000000_debt_sync_operations.sql`
- Read: `supabase/migrations/20260902000006_repair_debt_and_credit_card_operations.sql`
- Read: `apps/api/src/services/syncApplyOperation.ts`
- Optional Modify: `apps/api/src/services/syncApplyOperation.ts`
- Optional Test: `apps/api/src/__tests__/services/syncApplyOperation.debtAccounts.test.ts`

**Interfaces:**
- Consumes: Task 2 create/update payload shape for `debt_accounts`.
- Produces: confirmation that queued local debt account operations can be accepted by backend sync.

- [ ] **Step 1: Check allowed create/update fields**

Search server sync code for debt account handling:

```bash
grep -R "debt_accounts" -n apps/api/src/services/syncApplyOperation.ts supabase/migrations/20260822000000_debt_sync_operations.sql supabase/migrations/20260902000006_repair_debt_and_credit_card_operations.sql
```

Expected: server functions already allow `debt_accounts` with `name`, `lender_name`, `preset_key`, balances, interest fields, dates, `preset_data`, notes, status, archive/delete behavior.

- [ ] **Step 2: If API sanitizer lacks debt account support, add failing API test**

Create `apps/api/src/__tests__/services/syncApplyOperation.debtAccounts.test.ts` with a create operation payload matching Task 2 and assert it applies or calls Supabase with sanitized `debt_accounts` fields. Follow existing patterns in `apps/api/src/__tests__/services/syncApplyOperation.creditCardTransactions.test.ts`.

- [ ] **Step 3: If needed, extend `apps/api/src/services/syncApplyOperation.ts`**

Add `debt_accounts` to the allowed entity list and define debt account create/update fields. Do not allow credit-card account creation through this path. Validate:

```ts
const DEBT_ACCOUNT_CREATE_FIELDS = new Set([
  "linked_account_id",
  "name",
  "lender_name",
  "preset_key",
  "status",
  "original_balance_centavos",
  "current_balance_centavos",
  "annual_interest_rate_bps",
  "minimum_payment_centavos",
  "payment_frequency",
  "next_due_date",
  "maturity_date",
  "target_payoff_date",
  "interest_period",
  "interest_method",
  "preset_data",
  "notes",
]);
```

Reject create when `preset_key` is outside:

```ts
["personal_loan", "salary_loan", "multipurpose_loan", "business_loan", "auto_loan", "custom_debt"]
```

- [ ] **Step 4: Run API sync tests if modified**

```bash
pnpm --dir apps/api test -- syncApplyOperation.debtAccounts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit only if code changed**

```bash
git add apps/api/src/services/syncApplyOperation.ts apps/api/src/__tests__/services/syncApplyOperation.debtAccounts.test.ts
git commit -m "fix(api): accept debt account sync payloads"
```

---

### Task 9: Final Verification

**Files:**
- Read/verify: all files changed by Tasks 1-8.

**Interfaces:**
- Consumes: complete feature slice.
- Produces: verified implementation ready for review.

- [ ] **Step 1: Run focused frontend tests**

```bash
pnpm --dir apps/app test -- debtAccounts.test.ts NonCreditDebtForm.test.tsx DebtManagerOverview.nonCreditDebts.test.tsx DebtManagerScreen.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm --dir apps/app exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Manually verify UI flow**

Run Expo using the project’s normal local dev command:

```bash
pnpm --dir apps/app start
```

Manual expected behavior:

- Debt Manager shows a Credit Cards card and a separate Non-credit-card debts section.
- Empty non-credit-card debt list displays: `No debts are recorded yet. Add a debt to track repayment progress.`
- Add debt opens the debt form.
- Debt type selector includes Personal Loan, Salary Loan, Multipurpose Loan, Business Loan, Auto Loan, Custom Debt.
- Credit cards are not shown as debt type choices.
- Required blank fields show: `Some debt details are not valid. Check the highlighted fields and try again.`
- Saving a valid debt returns to the overview.
- New debt displays Active status and `No payments recorded yet.`
- Edit debt updates the same debt record.
- Archive debt requires `Archive debt` then `Confirm archive`.
- Delete debt requires `Delete debt` then `Confirm delete`.

- [ ] **Step 4: Confirm no out-of-scope work slipped in**

Check the diff:

```bash
git diff --stat HEAD
git diff HEAD -- apps/app/features/debt-manager apps/app/local-db/repositories/debtAccounts.ts apps/app/local-db/repositories/__tests__/debtAccounts.test.ts
```

Expected:

- No debt payment creation UI.
- No related transaction flow.
- No Snowball/Avalanche strategy UI.
- No priority/unpriority UI.
- No hardship plan UI.
- Credit-card module untouched except existing overview navigation remains intact.

- [ ] **Step 5: Commit final fixes if any**

```bash
git add apps/app apps/api
git commit -m "test(frontend): verify non-credit-card debt creation"
```

Only run this commit if Step 1-4 required additional fixes after prior task commits.

---

## Self-Review

**Spec coverage:**

- 7.9 covered for create/edit/list/status/progress/archive/delete. Payment, priority, related transaction, and hardship are intentionally excluded by user scope.
- 7.10 covered for Active/Archived/Deleted/Finished labels and archived-not-finished distinction. Ahead/On Schedule/Behind derivation is basic until payments exist; no-payment default is explicit.
- 7.13 covered for common form fields. Fees and penalty information are stored in `preset_data`.
- 7.14 covered for the six non-credit-card debt presets; credit cards excluded.
- 7.15 and 7.15.1 covered through `debtTypes.ts` placeholders and form inputs.
- 7.16 intentionally excluded except no strategy implementation.
- 7.17-7.21 intentionally excluded because payment recording is out of scope.
- 7.22 covered for type-specific inputs.
- 7.23 covered in repository validation and form validation.
- 7.24 covered for initial/loading/empty/input validation/saving/active/archived/deleted/finished/error/delete/archive/success states where relevant to creation.
- 7.25 covered for required validation, error, notice, progress, confirmation, and recovery copy relevant to creation/archive/delete.
- 7.26 strategy/payment calculations intentionally excluded.

**Placeholder scan:** This plan contains no TBD/TODO placeholders. Optional API sync work is bounded by an explicit compatibility check because current migrations already show server debt sync support.

**Type consistency:** Repository types use snake_case only for DB/sync payloads and camelCase for app domain/UI. UI imports repository domain types directly and does not create parallel debt shapes.

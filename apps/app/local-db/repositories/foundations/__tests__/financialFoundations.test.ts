import { jest } from "@jest/globals";

const mockInitDatabase = jest.fn<(...args: any[]) => any>();
const mockEnqueueOperation = jest.fn<(...args: any[]) => any>();
const mockRandomUUID = jest.fn(() => "record-1");

jest.mock("../../../client", () => ({
  initDatabase: (...args: any[]) => mockInitDatabase(...args),
}));

jest.mock("../../../helpers", () => {
  const actual = jest.requireActual("../../../helpers") as Record<string, unknown>;
  return {
    ...actual,
    enqueueOperation: (...args: any[]) => mockEnqueueOperation(...args),
  };
});

jest.mock("../../../uuid", () => ({
  randomUUID: () => mockRandomUUID(),
}));

type MockDb = {
  getFirstAsync: jest.Mock<any>;
  runAsync: jest.Mock<any>;
  withTransactionAsync: jest.Mock<any>;
};

function createDbMock(getFirstAsync: unknown): MockDb {
  return {
    getFirstAsync: getFirstAsync as jest.Mock<any>,
    runAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (work: (tx: () => Promise<void>) => Promise<void>) => {
      await work(async () => undefined);
    }),
  };
}

describe("financial account inserts", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset();
    mockRandomUUID.mockClear();
    mockRandomUUID.mockReturnValue("account-1");
    mockEnqueueOperation.mockResolvedValue({ operation_id: "sync-1" });
  });

  test("creates a credit-card account with matching insert columns and values", async () => {
    const db = createDbMock(jest.fn(async () => ({
      id: "account-1",
      name: "Visa Platinum",
      kind: "credit_card",
      status: "active",
      opening_balance_centavos: 0,
      current_balance_centavos: 0,
      include_in_dashboard_balance: 1,
      institution_name: null,
      opened_on: null,
      archived_at: null,
      deleted_at: null,
      sort_order: 0,
      metadata: "{}",
      version: 1,
      deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      last_synced_at: null,
      cc_credit_limit_centavos: 2500000,
      cc_billing_cycle_days: 30,
      cc_cutoff_day: 15,
      cc_statement_day: 5,
      cc_alert_threshold_percent: 80,
    })));
    mockInitDatabase.mockResolvedValue(db);

    const { createFinancialAccount } = await import("../financialFoundations");
    await createFinancialAccount("user-1", "device-1", {
      name: "Visa Platinum",
      kind: "credit_card",
      creditCardDetails: {
        creditLimitCentavos: 2500000,
        billingCycleDays: 30,
        cutoffDay: 15,
        statementDay: 5,
        alertThresholdPercent: 80,
      },
    });

    const accountInsert = db.runAsync.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO financial_accounts"));
    expect(accountInsert).toBeTruthy();
    const sql = String(accountInsert?.[0]);
    const columns = sql.match(/\(([^)]+)\)\s*VALUES/)?.[1]?.split(",").length;
    const values = sql.match(/VALUES\s*\(([^)]+)\)/)?.[1]?.split(",").length;
    expect(values).toBe(columns);
    expect(mockEnqueueOperation.mock.calls[1]![1].payload).not.toHaveProperty("available_credit_centavos");
  });

  test("does not queue an unchanged account kind during a credit-card edit", async () => {
    const existing = {
      id: "account-1", user_id: "user-1", name: "Visa Platinum", kind: "credit_card",
      status: "active", opening_balance_centavos: 0, current_balance_centavos: 0,
      include_in_dashboard_balance: 1, institution_name: null, opened_on: null,
      archived_at: null, deleted_at: null, sort_order: 0, metadata: "{}",
      version: 2, deleted: 0, created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z", last_synced_at: null,
    };
    const db = createDbMock(jest.fn(async () => existing));
    mockInitDatabase.mockResolvedValue(db);

    const { updateFinancialAccount } = await import("../financialFoundations");
    const result = await updateFinancialAccount("user-1", "device-1", "account-1", {
      kind: "credit_card",
      creditCardDetails: {
        creditLimitCentavos: 2500000,
        billingCycleDays: 30,
        cutoffDay: 15,
        alertThresholdPercent: 80,
      },
    });

    expect(result.operation).toBeDefined();
    expect(mockEnqueueOperation).toHaveBeenCalledTimes(2);
    expect(mockEnqueueOperation.mock.calls[1]![1].changedFields).not.toContain("kind");
    expect(mockEnqueueOperation.mock.calls[1]![1].payload).not.toHaveProperty("kind");
  });

  test("reconciles available credit when editing credit-card details", async () => {
    const existing = {
      id: "account-1", user_id: "user-1", name: "Visa Platinum", kind: "credit_card",
      status: "active", opening_balance_centavos: 0, current_balance_centavos: 0,
      include_in_dashboard_balance: 1, institution_name: null, opened_on: null,
      archived_at: null, deleted_at: null, sort_order: 0, metadata: "{}",
      version: 2, deleted: 0, created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z", last_synced_at: null,
    };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("SELECT version FROM credit_card_details")) return { version: 3 };
      return existing;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { updateFinancialAccount } = await import("../financialFoundations");
    await updateFinancialAccount("user-1", "device-1", "account-1", {
      creditCardDetails: {
        creditLimitCentavos: 3000000,
        billingCycleDays: 30,
        cutoffDay: 15,
        alertThresholdPercent: 80,
      },
    });

    const upsert = db.runAsync.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO credit_card_details"));
    const normalizedSql = String(upsert?.[0]).replace(/\s+/g, " ");
    expect(normalizedSql).toContain("available_credit_centavos = excluded.available_credit_centavos");
    expect(upsert?.[4]).toBe(3000000);
  });
});

describe("issuer available-credit reconciliation", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset();
    mockEnqueueOperation.mockResolvedValue({ operation_id: "sync-1" });
  });

  test("rejects negative and over-limit available credit", async () => {
    const db = createDbMock(jest.fn(async () => ({ credit_limit_centavos: 100_000, version: 3 })));
    mockInitDatabase.mockResolvedValue(db);
    const { reconcileCreditCardAvailableCredit } = await import("../financialFoundations");

    await expect(reconcileCreditCardAvailableCredit("user-1", "device-1", "card-1", -1)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(reconcileCreditCardAvailableCredit("user-1", "device-1", "card-1", 100_001)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Available credit cannot exceed the credit limit.",
    });
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockEnqueueOperation).not.toHaveBeenCalled();
  });

  test("persists and queues an available-credit-only reconciliation", async () => {
    const db = createDbMock(jest.fn(async () => ({ credit_limit_centavos: 100_000, version: 3 })));
    mockInitDatabase.mockResolvedValue(db);
    const { reconcileCreditCardAvailableCredit } = await import("../financialFoundations");

    await reconcileCreditCardAvailableCredit("user-1", "device-1", "card-1", 80_000);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("reconciled_available_credit_centavos = ?"),
      80_000, 80_000,
      expect.any(String),
      expect.any(String),
      "card-1",
      "user-1",
    );
    expect(mockEnqueueOperation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      changedFields: ["available_credit_centavos", "reconciled_available_credit_centavos", "pre_reconciliation_available_credit_centavos", "available_credit_reconciled_at"],
      payload: expect.objectContaining({ available_credit_centavos: 80_000, reconciled_available_credit_centavos: 80_000, pre_reconciliation_available_credit_centavos: 100_000, available_credit_reconciled_at: expect.any(String) }),
    }));
  });
});

describe("income source recurring linkage", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset();
    mockRandomUUID.mockReset();
    mockEnqueueOperation.mockResolvedValue({ operation_id: "sync-1" });
  });

  test("createIncomeSource also creates a linked recurring template", async () => {
    mockRandomUUID.mockReturnValueOnce("income-1").mockReturnValueOnce("template-1");
    const templateRow = {
      id: "template-1", user_id: "user-1", transaction_type: "income", status: "active", name: "Salary",
      amount_centavos: 50000, subcategory_id: "subcategory-1", source_account_id: null, destination_account_id: "account-1",
      frequency: "monthly", interval_count: 1, day_of_month: 15, second_day_of_month: null, day_of_week: null,
      custom_rule: "", starts_on: "2026-01-15", ends_on: null, next_occurrence_date: null, last_generated_date: null,
      reminder_enabled: 0, reminder_days_before: 0, notes: null, version: 1, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", last_synced_at: null,
    };
    const sourceRow = {
      id: "income-1", user_id: "user-1", recurring_template_id: "template-1", destination_account_id: "account-1", subcategory_id: "subcategory-1",
      name: "Salary", frequency: "monthly", expected_amount_centavos: 50000,
      payday_day_of_month: 15, payday_second_day_of_month: null, payday_day_of_week: null, next_expected_date: null,
      is_active: 1, notes: null, metadata: "{}", version: 1, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", last_synced_at: null,
    };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("FROM financial_accounts")) return { id: "account-1" };
      if (sql.includes("FROM subcategories")) return { id: "subcategory-1" };
      if (sql.includes("SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ?")) return templateRow;
      if (sql.includes("SELECT * FROM income_sources WHERE id = ?")) return sourceRow;
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { createIncomeSource } = await import("../financialFoundations");
    const result = await createIncomeSource("user-1", "device-1", {
      name: "Salary",
      frequency: "monthly",
      destinationAccountId: "account-1",
      subcategoryId: "subcategory-1",
      expectedAmountCentavos: 50000,
      paydayDayOfMonth: 15,
    });

    expect(result.source.recurringTemplateId).toBe("template-1");
    expect(db.runAsync).toHaveBeenCalled();
    expect(mockEnqueueOperation).toHaveBeenCalledTimes(2);
  });

  test("updateIncomeSource also updates its linked recurring template", async () => {
    const existing = {
      id: "income-1", user_id: "user-1", recurring_template_id: "template-1", destination_account_id: "account-1", subcategory_id: "subcategory-1",
      name: "Salary", frequency: "monthly", expected_amount_centavos: 50000,
      payday_day_of_month: 15, payday_second_day_of_month: null, payday_day_of_week: null, next_expected_date: null,
      is_active: 1, notes: null, metadata: "{}", version: 3, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", last_synced_at: null,
    };
    const recurringCurrent = {
      id: "template-1", user_id: "user-1", transaction_type: "income", status: "active", name: "Salary",
      amount_centavos: 50000, subcategory_id: "subcategory-1", source_account_id: null, destination_account_id: "account-1",
      frequency: "monthly", interval_count: 1, day_of_month: 15, second_day_of_month: null, day_of_week: null,
      custom_rule: "", starts_on: "2026-01-15", ends_on: null, next_occurrence_date: null, last_generated_date: null,
      reminder_enabled: 0, reminder_days_before: 0, notes: null, version: 2, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", last_synced_at: null,
    };
    const updatedSource = { ...existing, expected_amount_centavos: 60000, version: 4 };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM income_sources WHERE user_id = ? AND id = ? AND deleted = 0")) return existing;
      if (sql.includes("FROM financial_accounts")) return { id: "account-1" };
      if (sql.includes("FROM subcategories")) return { id: "subcategory-1" };
      if (sql.includes("SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0")) return recurringCurrent;
      if (sql.includes("SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ?")) return recurringCurrent;
      if (sql.includes("SELECT * FROM income_sources WHERE id = ?")) return updatedSource;
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { updateIncomeSource } = await import("../financialFoundations");
    const result = await updateIncomeSource("user-1", "device-1", "income-1", {
      expectedAmountCentavos: 60000,
      destinationAccountId: "account-1",
      subcategoryId: "subcategory-1",
    });

    expect(result.source.expectedAmountCentavos).toBe(60000);
    expect(mockEnqueueOperation).toHaveBeenCalledTimes(2);
  });

  test("updateIncomeSource rejects a twice-a-month schedule that collapses in February", async () => {
    const existing = {
      id: "income-1", user_id: "user-1", recurring_template_id: "template-1", destination_account_id: "account-1", subcategory_id: "subcategory-1",
      name: "Salary", frequency: "monthly", expected_amount_centavos: 50000,
      payday_day_of_month: 28, payday_second_day_of_month: null, payday_day_of_week: null, next_expected_date: null,
      is_active: 1, notes: null, metadata: "{}", version: 3, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", last_synced_at: null,
    };
    const db = createDbMock(jest.fn(async (sql: string) => (sql.includes("FROM income_sources") ? existing : null)));
    mockInitDatabase.mockResolvedValue(db);

    const { updateIncomeSource } = await import("../financialFoundations");
    await expect(updateIncomeSource("user-1", "device-1", "income-1", { frequency: "semi_monthly", paydaySecondDayOfMonth: 30 }))
      .rejects.toThrow("Date 1 must be the 27th or earlier when Date 2 is after the 28th");
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test("deleteIncomeSource also deletes its linked recurring template", async () => {
    const existing = {
      id: "income-1", user_id: "user-1", recurring_template_id: "template-1", destination_account_id: "account-1", subcategory_id: "subcategory-1",
      name: "Salary", frequency: "monthly", expected_amount_centavos: 50000,
      payday_day_of_month: 15, payday_second_day_of_month: null, payday_day_of_week: null, next_expected_date: null,
      is_active: 1, notes: null, metadata: "{}", version: 3, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", last_synced_at: null,
    };
    const deletedTemplate = {
      id: "template-1", user_id: "user-1", transaction_type: "income", status: "deleted", name: "Salary",
      amount_centavos: 50000, subcategory_id: "subcategory-1", source_account_id: null, destination_account_id: "account-1",
      frequency: "monthly", interval_count: 1, day_of_month: 15, second_day_of_month: null, day_of_week: null,
      custom_rule: "", starts_on: "2026-01-15", ends_on: null, next_occurrence_date: null, last_generated_date: null,
      reminder_enabled: 0, reminder_days_before: 0, notes: null, version: 4, deleted: 1,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", last_synced_at: null,
    };
    const deletedSource = { ...existing, deleted: 1, is_active: 0, version: 4 };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM income_sources WHERE user_id = ? AND id = ? AND deleted = 0")) return existing;
      if (sql.includes("SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ? AND deleted = 0")) return { ...deletedTemplate, deleted: 0, status: "active", version: 3 };
      if (sql.includes("SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND id = ?")) return deletedTemplate;
      if (sql.includes("SELECT * FROM income_sources WHERE id = ?")) return deletedSource;
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { deleteIncomeSource } = await import("../financialFoundations");
    await deleteIncomeSource("user-1", "device-1", "income-1");

    expect(mockEnqueueOperation).toHaveBeenCalledTimes(2);
  });
});

describe("income schedule validation", () => {
  const schedule = { frequency: "monthly" as const, paydayDayOfMonth: null, paydaySecondDayOfMonth: null, paydayDayOfWeek: null };

  test("monthly needs one payday and accepts the 31st", async () => {
    const { incomeScheduleError } = await import("../financialFoundations");
    expect(incomeScheduleError(schedule)).toBe("Enter a payday from 1 to 31.");
    expect(incomeScheduleError({ ...schedule, paydayDayOfMonth: 31 })).toBeNull();
  });

  test("twice a month needs Date 1 before Date 2, still distinct in February", async () => {
    const { incomeScheduleError } = await import("../financialFoundations");
    const twice = { ...schedule, frequency: "semi_monthly" as const };
    expect(incomeScheduleError({ ...twice, paydayDayOfMonth: 15 })).toBe("Enter Date 1 and Date 2, each from 1 to 31.");
    expect(incomeScheduleError({ ...twice, paydayDayOfMonth: 30, paydaySecondDayOfMonth: 15 })).toBe("Date 1 must come before Date 2.");
    expect(incomeScheduleError({ ...twice, paydayDayOfMonth: 28, paydaySecondDayOfMonth: 31 })).toMatch(/^Date 1 must be the 27th or earlier/);
    expect(incomeScheduleError({ ...twice, paydayDayOfMonth: 15, paydaySecondDayOfMonth: 31 })).toBeNull();
    expect(incomeScheduleError({ ...twice, paydayDayOfMonth: 27, paydaySecondDayOfMonth: 28 })).toBeNull();
  });

  test("every week needs a weekday and every day needs nothing", async () => {
    const { incomeScheduleError } = await import("../financialFoundations");
    expect(incomeScheduleError({ ...schedule, frequency: "weekly" })).toBe("Select the payday of the week.");
    expect(incomeScheduleError({ ...schedule, frequency: "weekly", paydayDayOfWeek: 5 })).toBeNull();
    expect(incomeScheduleError({ ...schedule, frequency: "daily" })).toBeNull();
  });
});

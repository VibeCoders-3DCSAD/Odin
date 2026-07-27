const mockInitDatabase = jest.fn();
const mockEnqueueOperation = jest.fn();
const mockRandomUUID = jest.fn(() => "obligation-1");

jest.mock("../../client", () => ({
  initDatabase: (...args: unknown[]) => mockInitDatabase(...args),
}));

jest.mock("../../helpers", () => {
  const actual = jest.requireActual("../../helpers");
  return {
    ...actual,
    enqueueOperation: (...args: unknown[]) => mockEnqueueOperation(...args),
  };
});

jest.mock("../../uuid", () => ({
  randomUUID: (...args: unknown[]) => mockRandomUUID(...args),
}));

type MockDb = {
  getFirstAsync: jest.Mock;
  runAsync: jest.Mock;
  withTransactionAsync: jest.Mock<Promise<void>, [(tx: () => Promise<void>) => Promise<void>]>;
};

function createDbMock(getFirstAsync: jest.Mock): MockDb {
  return {
    getFirstAsync,
    runAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => {
      await work();
    }),
  };
}

describe("financial obligation recurring template validation", () => {
  beforeEach(() => {
    jest.resetModules();
    mockInitDatabase.mockReset();
    mockEnqueueOperation.mockReset();
    mockRandomUUID.mockClear();
    mockEnqueueOperation.mockResolvedValue({ operation_id: "sync-1" });
  });

  test("createFinancialObligation rejects invalid recurringTemplateId", async () => {
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("FROM subcategories")) return { id: "subcategory-1" };
      if (sql.includes("FROM recurring_transaction_templates")) return null;
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { createFinancialObligation } = await import("../financialFoundations");

    await expect(
      createFinancialObligation("user-1", "device-1", {
        subcategoryId: "subcategory-1",
        recurringTemplateId: "missing-template",
        name: "Rent",
        amountCentavos: 1000,
        frequency: "monthly",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "recurringTemplateId does not reference an accessible recurring transaction template",
    });

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockEnqueueOperation).not.toHaveBeenCalled();
  });

  test("updateFinancialObligation rejects invalid recurringTemplateId", async () => {
    const existing = {
      id: "obligation-1",
      user_id: "user-1",
      subcategory_id: "subcategory-1",
      recurring_template_id: null,
      name: "Rent",
      status: "active",
      amount_centavos: 1000,
      frequency: "monthly",
      due_day_of_month: null,
      due_second_day_of_month: null,
      due_day_of_week: null,
      due_second_day_of_week: null,
      due_month: null,
      is_family_support: 0,
      is_dependent_support: 0,
      protected_by_default: 1,
      starts_on: null,
      ends_on: null,
      notes: null,
      metadata: "{}",
      version: 3,
      deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      last_synced_at: null,
    };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM financial_obligations WHERE user_id = ? AND id = ? AND deleted = 0")) {
        return existing;
      }
      if (sql.includes("FROM recurring_transaction_templates")) return null;
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { updateFinancialObligation } = await import("../financialFoundations");

    await expect(
      updateFinancialObligation("user-1", "device-1", "obligation-1", {
        recurringTemplateId: "missing-template",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "recurringTemplateId does not reference an accessible recurring transaction template",
    });

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockEnqueueOperation).not.toHaveBeenCalled();
  });

  test("updateFinancialObligation allows recurringTemplateId to be cleared with null", async () => {
    const existing = {
      id: "obligation-1",
      user_id: "user-1",
      subcategory_id: "subcategory-1",
      recurring_template_id: "template-1",
      name: "Rent",
      status: "active",
      amount_centavos: 1000,
      frequency: "monthly",
      due_day_of_month: null,
      due_second_day_of_month: null,
      due_day_of_week: null,
      due_second_day_of_week: null,
      due_month: null,
      is_family_support: 0,
      is_dependent_support: 0,
      protected_by_default: 1,
      starts_on: null,
      ends_on: null,
      notes: null,
      metadata: "{}",
      version: 3,
      deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      last_synced_at: null,
    };
    const cleared = {
      ...existing,
      recurring_template_id: null,
      version: 4,
    };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM financial_obligations WHERE user_id = ? AND id = ? AND deleted = 0")) {
        return existing;
      }
      if (sql.includes("SELECT * FROM financial_obligations WHERE id = ?")) {
        return cleared;
      }
      if (sql.includes("FROM recurring_transaction_templates")) {
        throw new Error("template lookup should not run for null recurringTemplateId");
      }
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { updateFinancialObligation } = await import("../financialFoundations");

    const result = await updateFinancialObligation("user-1", "device-1", "obligation-1", {
      recurringTemplateId: null,
    });

    expect(result.obligation.recurringTemplateId).toBeNull();
    expect(db.runAsync).toHaveBeenCalled();
    expect(mockEnqueueOperation).toHaveBeenCalled();
  });

  test("linkObligationToRecurringTemplate sets template id", async () => {
    const existing = {
      id: "obligation-1", user_id: "user-1", subcategory_id: "subcategory-1",
      recurring_template_id: null, name: "Rent", status: "active",
      amount_centavos: 1000, frequency: "monthly",
      due_day_of_month: null, due_second_day_of_month: null,
      due_day_of_week: null, due_second_day_of_week: null, due_month: null,
      is_family_support: 0, is_dependent_support: 0, protected_by_default: 1,
      starts_on: null, ends_on: null, notes: null,
      metadata: "{}", version: 3, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
      last_synced_at: null,
    };
    const updated = { ...existing, recurring_template_id: "template-1", version: 4 };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM financial_obligations WHERE user_id")) return existing;
      if (sql.includes("SELECT * FROM financial_obligations WHERE id = ?")) return updated;
      if (sql.includes("FROM recurring_transaction_templates")) return { id: "template-1" };
      if (sql.includes("FROM subcategories")) return { id: "subcategory-1" };
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { linkObligationToRecurringTemplate } = await import("../financialFoundations");
    const result = await linkObligationToRecurringTemplate("user-1", "device-1", "obligation-1", "template-1");

    expect(result.obligation.recurringTemplateId).toBe("template-1");
    expect(db.runAsync).toHaveBeenCalled();
    expect(mockEnqueueOperation).toHaveBeenCalled();
  });

  test("linkObligationToRecurringTemplate clears template id with null", async () => {
    const existing = {
      id: "obligation-1", user_id: "user-1", subcategory_id: "subcategory-1",
      recurring_template_id: "template-1", name: "Rent", status: "active",
      amount_centavos: 1000, frequency: "monthly",
      due_day_of_month: null, due_second_day_of_month: null,
      due_day_of_week: null, due_second_day_of_week: null, due_month: null,
      is_family_support: 0, is_dependent_support: 0, protected_by_default: 1,
      starts_on: null, ends_on: null, notes: null,
      metadata: "{}", version: 3, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
      last_synced_at: null,
    };
    const cleared = { ...existing, recurring_template_id: null, version: 4 };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM financial_obligations WHERE user_id")) return existing;
      if (sql.includes("SELECT * FROM financial_obligations WHERE id = ?")) return cleared;
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { linkObligationToRecurringTemplate } = await import("../financialFoundations");
    const result = await linkObligationToRecurringTemplate("user-1", "device-1", "obligation-1", null);

    expect(result.obligation.recurringTemplateId).toBeNull();
    expect(db.runAsync).toHaveBeenCalled();
    expect(mockEnqueueOperation).toHaveBeenCalled();
  });

  test("automateObligation creates template and links it", async () => {
    const obligationRow = {
      id: "obligation-1", user_id: "user-1", subcategory_id: "subcategory-1",
      recurring_template_id: null, name: "Rent", status: "active",
      amount_centavos: 50000, frequency: "monthly",
      due_day_of_month: 15, due_second_day_of_month: null,
      due_day_of_week: null, due_second_day_of_week: null, due_month: null,
      is_family_support: 0, is_dependent_support: 0, protected_by_default: 1,
      starts_on: null, ends_on: null, notes: null,
      metadata: "{}", version: 3, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
      last_synced_at: null,
    };
    const updatedObligation = { ...obligationRow, recurring_template_id: "template-1", version: 4 };
    const templateRow = {
      id: "template-1", user_id: "user-1", transaction_type: "expense",
      status: "active", name: "Rent", amount_centavos: 50000,
      subcategory_id: "subcategory-1", source_account_id: null, destination_account_id: null,
      frequency: "monthly", interval_count: 1,
      day_of_month: 15, second_day_of_month: null, day_of_week: null,
      custom_rule: "", starts_on: new Date().toISOString().split("T")[0],
      ends_on: null, next_occurrence_date: null, last_generated_date: null,
      reminder_enabled: 0, reminder_days_before: 0, notes: null,
      version: 1, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
      last_synced_at: null,
    };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("financial_obligations") && sql.includes("AND deleted = 0")) {
        return obligationRow;
      }
      if (sql.includes("financial_obligations WHERE id = ?")) {
        return updatedObligation;
      }
      if (sql.includes("recurring_transaction_templates")) {
        return templateRow;
      }
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);
    mockRandomUUID
      .mockReturnValueOnce("template-1")
      .mockReturnValueOnce("sync-1")
      .mockReturnValueOnce("sync-2");

    const { automateObligation } = await import("../financialFoundations");
    const result = await automateObligation("user-1", "device-1", "obligation-1");

    expect(result.obligation.recurringTemplateId).toBe("template-1");
    expect(db.runAsync).toHaveBeenCalled();
  });

  test("automateObligation rejects already linked obligation", async () => {
    const linkedObligation = {
      id: "obligation-1", user_id: "user-1", subcategory_id: "subcategory-1",
      recurring_template_id: "existing-template", name: "Rent", status: "active",
      amount_centavos: 50000, frequency: "monthly",
      due_day_of_month: 15, due_second_day_of_month: null,
      due_day_of_week: null, due_second_day_of_week: null, due_month: null,
      is_family_support: 0, is_dependent_support: 0, protected_by_default: 1,
      starts_on: null, ends_on: null, notes: null,
      metadata: "{}", version: 3, deleted: 0,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
      last_synced_at: null,
    };
    const db = createDbMock(jest.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM financial_obligations WHERE user_id")) return linkedObligation;
      return null;
    }));
    mockInitDatabase.mockResolvedValue(db);

    const { automateObligation } = await import("../financialFoundations");

    await expect(
      automateObligation("user-1", "device-1", "obligation-1"),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "obligation already linked to a recurring template",
    });
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test("automateObligation rejects missing obligation", async () => {
    const db = createDbMock(jest.fn(async () => null));
    mockInitDatabase.mockResolvedValue(db);

    const { automateObligation } = await import("../financialFoundations");

    await expect(
      automateObligation("user-1", "device-1", "missing-obligation"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.runAsync).not.toHaveBeenCalled();
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
      name: "Salary", income_type: "stable", frequency: "monthly", expected_amount_centavos: 50000, min_amount_centavos: null, max_amount_centavos: null,
      payday_day_of_month: 15, payday_second_day_of_month: null, payday_day_of_week: null, payday_second_day_of_week: null, next_expected_date: null,
      estimated_interval_days: null, is_active: 1, notes: null, metadata: "{}", version: 1, deleted: 0,
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
      incomeType: "stable",
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
      name: "Salary", income_type: "stable", frequency: "monthly", expected_amount_centavos: 50000, min_amount_centavos: null, max_amount_centavos: null,
      payday_day_of_month: 15, payday_second_day_of_month: null, payday_day_of_week: null, payday_second_day_of_week: null, next_expected_date: null,
      estimated_interval_days: null, is_active: 1, notes: null, metadata: "{}", version: 3, deleted: 0,
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

  test("deleteIncomeSource also deletes its linked recurring template", async () => {
    const existing = {
      id: "income-1", user_id: "user-1", recurring_template_id: "template-1", destination_account_id: "account-1", subcategory_id: "subcategory-1",
      name: "Salary", income_type: "stable", frequency: "monthly", expected_amount_centavos: 50000, min_amount_centavos: null, max_amount_centavos: null,
      payday_day_of_month: 15, payday_second_day_of_month: null, payday_day_of_week: null, payday_second_day_of_week: null, next_expected_date: null,
      estimated_interval_days: null, is_active: 1, notes: null, metadata: "{}", version: 3, deleted: 0,
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

import { jest } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Operation, PreparedOperation } from "../../services/syncApplyOperation.js";
import {
  createMockQuery,
  createListQuery,
} from "../helpers/supabase.js";
import type { MockQueryResult } from "../helpers/supabase.js";

const mockFrom = jest.fn();
const mockClient = { from: mockFrom } as unknown as SupabaseClient;

const validUserId = "00000000-0000-0000-0000-000000000001";

// Dynamic import so the supabase module mock (if needed) is resolved first.
// We import prepareOperation lazily to avoid module-level mock conflicts.
let prepareOperation: (
  supabase: SupabaseClient,
  userId: string,
  op: Operation,
) => Promise<PreparedOperation>;

beforeAll(async () => {
  const mod = await import("../../services/syncApplyOperation.js");
  prepareOperation = mod.prepareOperation;
});

beforeEach(() => {
  mockFrom.mockReset();
});

// ---------------------------------------------------------------------------
// Entity allowlist
// ---------------------------------------------------------------------------

describe("prepareOperation — entity allowlist", () => {
  it("rejects unknown entities", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, {
        operation_id: "op-1",
        entity: "unknown_table",
        record_id: "rec-1",
        operation_type: "create",
        base_version: null,
        changed_fields: [],
        payload: {},
      }),
    ).rejects.toThrow("entity 'unknown_table' is not in the sync allowlist");
  });

  it.each(["categories", "subcategories", "financial_accounts", "income_sources", "financial_obligations", "budgets", "debt_accounts", "debt_payments", "user_debt_priorities", "debt_strategy_preferences"])(
    "accepts entity '%s'",
    async (entity) => {
      // Delete is the simplest operation; linked payments are create-only.
      const operationType = entity === "debt_payments" ? "create" : "delete";
      const result = await prepareOperation(mockClient, validUserId, {
        operation_id: "op-1",
        entity,
        record_id: "rec-1",
        operation_type: operationType,
        base_version: null,
        changed_fields: [],
        payload: entity === "debt_payments" ? { amount_centavos: 100, debt_account_id: "debt-1", transaction_id: "transaction-1", linked_transaction_type: "expense", linked_source_account_id: "account-1", linked_subcategory_id: "subcategory-1", source: "transaction", payment_date: "2026-08-21" } : {},
      });
      expect(result.entity).toBe(entity);
      expect(result.operation_type).toBe(operationType);
    },
  );
});

describe("prepareOperation — credit-card invariants", () => {
  it("accepts purchase_type for credit-card transactions", async () => {
    mockFrom.mockImplementation(() => createMockQuery({ data: { id: "reference-1" }, error: null }));
    const result = await prepareOperation(mockClient, validUserId, {
      operation_id: "cc-purchase",
      entity: "credit_card_transactions",
      record_id: "transaction-1",
      operation_type: "create",
      base_version: null,
      changed_fields: [],
      payload: {
        transaction_id: "transaction-1",
        account_id: "account-1",
        cycle_id: "cycle-1",
        purchase_type: "regular",
      },
    });

    expect(result.payload.purchase_type).toBe("regular");
    expect(result.payload.applied_credit_centavos).toBe(0);
  });

  it.each([
    ["credit_card_details", "available_credit_centavos"],
    ["credit_card_installments", "remaining_principal_centavos"],
    ["credit_card_installments", "remaining_months"],
    ["credit_card_transactions", "applied_credit_centavos"],
  ])("rejects generic updates to derived %s field %s", async (entity, field) => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: `derived-${field}`, entity, record_id: "record-1",
      operation_type: "update", base_version: 1, changed_fields: [field],
      payload: { [field]: 1 },
    })).rejects.toThrow("dedicated invariant-preserving operation");
  });

  it("rejects a linked payment transaction with the wrong amount or type", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "credit_card_cycles") return createMockQuery({ data: { id: "cycle-1" }, error: null });
      if (table === "transactions") return createMockQuery({ data: { id: "tx-1", transaction_type: "income", amount_centavos: 99, source_account_id: "source-1" }, error: null });
      throw new Error(`unexpected table lookup: ${table}`);
    });
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "cc-payment-transaction", entity: "credit_card_payments", record_id: "payment-1",
      operation_type: "create", base_version: null, changed_fields: [],
      payload: { cycle_id: "cycle-1", transaction_id: "tx-1", amount_centavos: 100, payment_date: "2026-09-03" },
    })).rejects.toThrow("payment transaction must be an accessible expense");
  });

  it("rejects available credit above the card limit before persistence", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "cc-limit", entity: "credit_card_details", record_id: "account-1",
      operation_type: "create", base_version: null, changed_fields: [],
      payload: { account_id: "account-1", credit_limit_centavos: 100, available_credit_centavos: 101, default_cutoff_date: "2026-09-15", default_statement_date: "2026-09-20" },
    })).rejects.toThrow("available_credit_centavos cannot exceed credit_limit_centavos");
  });

  it("rejects a custom strategy outside the issuer statement bounds", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "credit_card_statements") return createMockQuery({ data: { statement_balance_centavos: 1000, minimum_due_centavos: 100 }, error: null });
      if (table === "transactions") return createMockQuery({ data: { id: "tx-1" }, error: null });
      throw new Error(`unexpected table lookup: ${table}`);
    });
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "cc-strategy", entity: "credit_card_statement_strategies", record_id: "statement-1",
      operation_type: "create", base_version: null, changed_fields: [],
      payload: { statement_id: "statement-1", strategy: "custom", custom_amount_centavos: 1000 },
    })).rejects.toThrow("custom amount must be at least minimum due and less than statement balance");
  });

  it("rejects a payment whose statement belongs to another cycle", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "credit_card_statements") return createMockQuery({ data: { id: "statement-1", cycle_id: "cycle-2" }, error: null });
      throw new Error(`unexpected table lookup: ${table}`);
    });
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "cc-payment-cycle", entity: "credit_card_payments", record_id: "payment-1",
      operation_type: "create", base_version: null, changed_fields: [],
      payload: { cycle_id: "cycle-1", statement_id: "statement-1", amount_centavos: 100, payment_date: "2026-09-03" },
    })).rejects.toThrow("statement_id must belong to cycle_id");
  });
});

describe("prepareOperation — budgets create", () => {
  beforeEach(() => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") return createListQuery({ data: [{ id: "cat-1" }], error: null });
      if (table === "budgets") return createMockQuery({ data: null, error: null });
      throw new Error(`unexpected table lookup: ${table}`);
    });
  });

  it("accepts a valid user-scoped draft payload", async () => {
    const result = await prepareOperation(mockClient, validUserId, {
      operation_id: "op-budget-1",
      entity: "budgets",
      record_id: "budget-1",
      operation_type: "create",
      base_version: null,
      changed_fields: [],
      payload: {
        id: "budget-1",
        user_id: validUserId,
        status: "draft",
        allocation_method: "MANUAL",
        periodKind: "CUSTOM",
        periodStart: "2026-08-01",
        periodEnd: "2026-08-10",
        budget_period_days: 10,
        totalAmountMinor: 1000,
        allocations: [{ id: "allocation-1", categoryId: "cat-1", amountMinor: 100 }],
      },
    });
    expect(result.payload).toMatchObject({ periodKind: "CUSTOM", budget_period_days: 10 });
  });

  it("excludes deleted budgets from the single-budget check", async () => {
    await prepareOperation(mockClient, validUserId, {
      operation_id: "op-budget-deleted-check",
      entity: "budgets",
      record_id: "budget-1",
      operation_type: "create",
      base_version: null,
      changed_fields: [],
      payload: {
        status: "draft", allocation_method: "MANUAL", periodKind: "CUSTOM",
        periodStart: "2026-08-01", periodEnd: "2026-08-10", budget_period_days: 10,
        totalAmountMinor: 1000, allocations: [],
      },
    });

    const budgetQueryIndex = mockFrom.mock.calls.findIndex(([table]) => table === "budgets");
    const budgetQuery = mockFrom.mock.results[budgetQueryIndex]?.value as { neq: jest.Mock };
    expect(budgetQuery.neq).toHaveBeenCalledWith("status", "deleted");
  });

  it("rejects a wrong inclusive period length", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-budget-2",
      entity: "budgets",
      record_id: "budget-1",
      operation_type: "create",
      base_version: null,
      changed_fields: [],
      payload: {
        status: "draft", allocation_method: "MANUAL", periodKind: "CUSTOM",
        periodStart: "2026-08-01", periodEnd: "2026-08-10", budget_period_days: 9,
        totalAmountMinor: 1000, allocations: [],
      },
    })).rejects.toThrow("budget_period_days must match the inclusive date range");
  });

  it("rejects impossible calendar dates", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-budget-3", entity: "budgets", record_id: "budget-1",
      operation_type: "create", base_version: null, changed_fields: [],
      payload: {
        status: "draft", allocation_method: "MANUAL", periodKind: "CUSTOM",
        periodStart: "2026-02-31", periodEnd: "2026-03-02", budget_period_days: 1,
        totalAmountMinor: 1000, allocations: [],
      },
    })).rejects.toThrow("periodStart must be a valid calendar date");
  });

  it("enforces the same calendar day for monthly budgets", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-budget-4", entity: "budgets", record_id: "budget-1",
      operation_type: "create", base_version: null, changed_fields: [],
      payload: {
        status: "draft", allocation_method: "MANUAL", periodKind: "MONTHLY",
        periodStart: "2026-02-01", periodEnd: "2026-02-27", budget_period_days: 27,
        totalAmountMinor: 1000, allocations: [],
      },
    })).rejects.toThrow("MONTHLY budgets must cover one month from the start date");
  });

  it("accepts a monthly budget ending on the same day next month", async () => {
    const result = await prepareOperation(mockClient, validUserId, {
      operation_id: "op-budget-5", entity: "budgets", record_id: "budget-1",
      operation_type: "create", base_version: null, changed_fields: [],
      payload: {
        status: "draft", allocation_method: "MANUAL", periodKind: "MONTHLY",
        periodStart: "2026-08-14", periodEnd: "2026-09-14", budget_period_days: 32,
        totalAmountMinor: 1000, allocations: [],
      },
    });
    expect(result.payload).toMatchObject({ periodStart: "2026-08-14", periodEnd: "2026-09-14" });
  });

  it("accepts the local budget update sync field contract", async () => {
    const result = await prepareOperation(mockClient, validUserId, {
      operation_id: "op-budget-update-1",
      entity: "budgets",
      record_id: "budget-1",
      operation_type: "update",
      base_version: 1,
      changed_fields: ["periodKind", "periodStart", "periodEnd", "budget_period_days", "totalAmountMinor", "allocations"],
      payload: {
        periodKind: "CUSTOM",
        periodStart: "2026-08-01",
        periodEnd: "2026-08-10",
        budget_period_days: 10,
        totalAmountMinor: 1000,
        allocations: [{ id: "allocation-1", categoryId: "cat-1", amountMinor: 100 }],
      },
    });
    expect(result.payload).toMatchObject({ periodKind: "CUSTOM", totalAmountMinor: 1000 });
  });
});

describe("prepareOperation — debt entities", () => {
  it("preserves preset text and validates fee fields", async () => {
    const result = await prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-preset-text", entity: "debt_accounts", record_id: "debt-text", operation_type: "create", base_version: null, changed_fields: [],
      payload: { name: "Loan", preset_key: "personal_loan", preset_data: { purpose: "home repair", feesCentavos: 1250, penaltiesCentavos: 300, startDate: "2026-09-01" } },
    });
    expect(result.payload.preset_data).toEqual({ purpose: "home repair", feesCentavos: 1250, penaltiesCentavos: 300, startDate: "2026-09-01" });
  });

  it("accepts an unknown future preset while sanitizing server-owned fields", async () => {
    const result = await prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-1", entity: "debt_accounts", record_id: "debt-1", operation_type: "create", base_version: null, changed_fields: [],
      payload: { id: "debt-1", user_id: validUserId, name: "Future debt", preset_key: "future_lender_product", preset_data: { term: 12 }, version: 99 },
    });
    expect(result.payload).toEqual({ name: "Future debt", preset_key: "future_lender_product", preset_data: { term: 12 } });
  });

  it("preserves archived debt account creates", async () => {
    const result = await prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-archived", entity: "debt_accounts", record_id: "debt-archived", operation_type: "create", base_version: null, changed_fields: [],
      payload: { name: "Archived debt", preset_key: "credit_card", status: "archived" },
    });
    expect(result.payload).toMatchObject({ status: "archived" });
  });

  it("requires auto-loan original balance to equal financed principal", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-auto-principal", entity: "debt_accounts", record_id: "debt-auto", operation_type: "create", base_version: null, changed_fields: [],
      payload: { name: "Car", preset_key: "auto_loan", original_balance_centavos: 90000, preset_data: { termMonths: 60, vehicleDescription: "Sedan", vehiclePurchasePriceCentavos: 100000, downpaymentCentavos: 20000 } },
    })).rejects.toThrow("financed principal");
  });

  it("preserves paid-off debt account creates with their payoff timestamp", async () => {
    const result = await prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-paid-off", entity: "debt_accounts", record_id: "debt-paid-off", operation_type: "create", base_version: null, changed_fields: [],
      payload: { name: "Paid-off debt", preset_key: "credit_card", status: "paid_off", paid_off_at: "2026-08-21T10:00:00Z" },
    });
    expect(result.payload).toMatchObject({ status: "paid_off", paid_off_at: "2026-08-21T10:00:00Z" });
  });

  it("rejects invalid debt status and linked payment deletes", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-2", entity: "debt_accounts", record_id: "debt-1", operation_type: "create", base_version: null, changed_fields: [], payload: { name: "Debt", preset_key: "credit_card", status: "deleted" },
    })).rejects.toThrow("deleted must use the delete operation");
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-3", entity: "debt_payments", record_id: "payment-1", operation_type: "delete", base_version: 1, changed_fields: [], payload: {},
    })).rejects.toThrow("Debt payments can only be created through Debt Manager");
  });

  it("rejects debt updates without a field mask", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-empty-update", entity: "debt_accounts", record_id: "debt-1", operation_type: "update",
      base_version: 1, changed_fields: [], payload: { name: "Debt" },
    })).rejects.toThrow("Debt updates must include changed fields");
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-priority-empty-update", entity: "user_debt_priorities", record_id: validUserId, operation_type: "update",
      base_version: 1, changed_fields: [], payload: { priorities: [] },
    })).rejects.toThrow("Debt updates must include changed fields");
  });

  it("validates debt numeric, strategy, and priority payloads", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-4", entity: "debt_accounts", record_id: "debt-1", operation_type: "create", base_version: null, changed_fields: [], payload: { name: "Debt", preset_key: "credit_card", current_balance_centavos: -1 },
    })).rejects.toThrow("current_balance_centavos must be a non-negative integer");
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-5", entity: "debt_strategy_preferences", record_id: validUserId, operation_type: "update", base_version: null, changed_fields: ["strategy"], payload: { strategy: "custom" },
    })).rejects.toThrow("strategy must be snowball or avalanche");
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-6", entity: "user_debt_priorities", record_id: validUserId, operation_type: "update", base_version: null, changed_fields: ["priorities"], payload: { priorities: ["debt-1", "debt-1"] },
    })).rejects.toThrow("priorities must be a unique array of debt IDs");
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-7", entity: "debt_accounts", record_id: "debt-1", operation_type: "create", base_version: null, changed_fields: [], payload: { name: "Debt", preset_key: "credit_card", payment_frequency: "whenever", next_due_date: "2026-02-31" },
    })).rejects.toThrow("payment_frequency must be a supported frequency");
  });

  it("rejects a transaction on a standalone debt payment", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-payment-source", entity: "debt_payments", record_id: "payment-1", operation_type: "create", base_version: null, changed_fields: [],
      payload: { amount_centavos: 100, debt_account_id: "debt-1", transaction_id: "transaction-1", linked_transaction_type: "expense", linked_source_account_id: "account-1", linked_subcategory_id: "subcategory-1", payment_date: "2026-08-21", source: "manual" },
    })).rejects.toThrow("manual debt payments cannot have a transaction");
  });

  it("rejects debt payments missing linked transaction fields", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-payment-fields", entity: "debt_payments", record_id: "payment-1", operation_type: "create", base_version: null, changed_fields: [],
      payload: { amount_centavos: 100, debt_account_id: "debt-1", transaction_id: "transaction-1", linked_source_account_id: "account-1", linked_subcategory_id: "subcategory-1", source: "transaction", payment_date: "2026-08-21" },
    })).rejects.toThrow("linked_transaction_type is required");
  });

  it("accepts a debt payment link update", async () => {
    const result = await prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-payment-link", entity: "debt_payments", record_id: "payment-1", operation_type: "update",
      base_version: 1, changed_fields: ["transaction_id", "linked_transaction_type", "linked_source_account_id", "linked_subcategory_id", "source", "payment_date"],
      payload: { transaction_id: "transaction-1", linked_transaction_type: "expense", linked_source_account_id: "account-1", linked_subcategory_id: "subcategory-1", source: "transaction", payment_date: "2026-08-21" },
    });
    expect(result.operation_type).toBe("update");
  });

  it("rejects payment components whose sum exceeds the payment", async () => {
    await expect(prepareOperation(mockClient, validUserId, {
      operation_id: "op-debt-payment-components", entity: "debt_payments", record_id: "payment-1", operation_type: "create", base_version: null, changed_fields: [],
      payload: { amount_centavos: 100, principal_centavos: 60, interest_centavos: 50, debt_account_id: "debt-1", transaction_id: "transaction-1", linked_transaction_type: "expense", linked_source_account_id: "account-1", linked_subcategory_id: "subcategory-1", payment_date: "2026-08-21", source: "transaction" },
    })).rejects.toThrow("principal and interest cannot exceed amount_centavos");
  });
});

// ---------------------------------------------------------------------------
// Operation type validation
// ---------------------------------------------------------------------------

describe("prepareOperation — operation type validation", () => {
  it("rejects unknown operation types", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, {
        operation_id: "op-1",
        entity: "financial_accounts",
        record_id: "rec-1",
        operation_type: "destroy" as "create",
        base_version: null,
        changed_fields: [],
        payload: {},
      }),
    ).rejects.toThrow("Unknown operation_type");
  });
});

// ---------------------------------------------------------------------------
// financial_accounts — create
// ---------------------------------------------------------------------------

describe("prepareOperation — financial_accounts create", () => {
  const validCreatePayload = {
    name: "BPI Savings",
    kind: "bank",
    opening_balance_centavos: 500000,
    credit_limit_centavos: null,
    include_in_dashboard_balance: true,
    institution_name: "BPI",
    opened_on: "2026-01-15",
    sort_order: 0,
  };

  function op(overrides: Record<string, unknown> = {}): Operation {
    return {
      operation_id: "op-1",
      entity: "financial_accounts",
      record_id: "rec-1",
      operation_type: "create",
      base_version: null,
      changed_fields: Object.keys(validCreatePayload),
      payload: { ...validCreatePayload, ...overrides },
    };
  }

  it("creates a valid financial account", async () => {
    const result = await prepareOperation(mockClient, validUserId, op());
    expect(result.payload).toMatchObject({
      name: "BPI Savings",
      kind: "bank",
    });
  });

  it("rejects missing name", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ name: undefined })),
    ).rejects.toThrow("name is required");
  });

  it("rejects missing kind", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ kind: undefined })),
    ).rejects.toThrow("kind is required");
  });

  it("rejects invalid kind", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ kind: "crypto" })),
    ).rejects.toThrow(/kind must be one of/);
  });

  it("rejects negative credit_limit_centavos", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ credit_limit_centavos: -100 })),
    ).rejects.toThrow("credit_limit_centavos must be >= 0");
  });

  it("rejects unsyncable fields", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ current_balance_centavos: 999 })),
    ).rejects.toThrow("current_balance_centavos is not syncable");
  });
});

// ---------------------------------------------------------------------------
// income_sources — create
// ---------------------------------------------------------------------------

describe("prepareOperation — income_sources create", () => {
  const validCreatePayload: Record<string, unknown> = {
    name: "Freelance Work",
    income_type: "variable",
    frequency: "monthly",
    destination_account_id: "33333333-3333-3333-3333-333333333333",
    subcategory_id: "44444444-4444-4444-4444-444444444444",
    expected_amount_centavos: 1500000,
    min_amount_centavos: 500000,
    max_amount_centavos: 3000000,
    payday_day_of_month: 15,
    next_expected_date: "2026-08-15",
    is_active: true,
  };

  beforeEach(() => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "financial_accounts") {
        return createMockQuery({ data: { id: validCreatePayload.destination_account_id }, error: null });
      }
      if (table === "subcategories") {
        return createMockQuery({ data: { id: validCreatePayload.subcategory_id }, error: null });
      }
      if (table === "recurring_transaction_templates") {
        return createMockQuery({ data: null, error: null });
      }
      throw new Error(`unexpected table lookup: ${table}`);
    });
  });

  function op(overrides: Record<string, unknown> = {}): Operation {
    return {
      operation_id: "op-1",
      entity: "income_sources",
      record_id: "rec-1",
      operation_type: "create",
      base_version: null,
      changed_fields: Object.keys(validCreatePayload),
      payload: { ...validCreatePayload, ...overrides },
    };
  }

  it("creates a valid income source", async () => {
    const result = await prepareOperation(mockClient, validUserId, op());
    expect(result.payload).toMatchObject({ name: "Freelance Work" });
  });

  it("rejects missing destination_account_id", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ destination_account_id: undefined })),
    ).rejects.toThrow("destination_account_id is required");
  });

  it("rejects missing subcategory_id", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ subcategory_id: undefined })),
    ).rejects.toThrow("subcategory_id is required");
  });

  it("rejects missing name", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ name: undefined })),
    ).rejects.toThrow("name is required");
  });

  it("rejects invalid income_type", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ income_type: "passive" })),
    ).rejects.toThrow(/income_type must be one of/);
  });

  it("rejects invalid frequency", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ frequency: "yearly" })),
    ).rejects.toThrow(/frequency must be one of/);
  });

  it("rejects negative expected_amount_centavos", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ expected_amount_centavos: -1 })),
    ).rejects.toThrow("expected_amount_centavos must be >= 0");
  });

  it("rejects min > max", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ min_amount_centavos: 500, max_amount_centavos: 100 })),
    ).rejects.toThrow("min_amount_centavos must be <= max_amount_centavos");
  });

  it("rejects payday_day_of_month out of range", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ payday_day_of_month: 32 })),
    ).rejects.toThrow("payday_day_of_month must be between 1 and 31");
  });

  it("rejects payday_day_of_week out of range", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ payday_day_of_week: 7 })),
    ).rejects.toThrow("payday_day_of_week must be between 0 and 6");
  });
});

describe("prepareOperation — recurring_transaction_templates create", () => {
  const validCreatePayload: Record<string, unknown> = {
    transaction_type: "income",
    name: "Salary recurring",
    amount_centavos: 500000,
    frequency: "biweekly",
    interval_count: 1,
    day_of_week: 5,
    starts_on: "2026-08-01",
    destination_account_id: "33333333-3333-3333-3333-333333333333",
    subcategory_id: "44444444-4444-4444-4444-444444444444",
  };

  function op(overrides: Record<string, unknown> = {}): Operation {
    return {
      operation_id: "op-recurring-1",
      entity: "recurring_transaction_templates",
      record_id: "recurring-rec-1",
      operation_type: "create",
      base_version: null,
      changed_fields: Object.keys(validCreatePayload),
      payload: { ...validCreatePayload, ...overrides },
    };
  }

  beforeEach(() => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "financial_accounts") {
        return createMockQuery({ data: { id: validCreatePayload.destination_account_id }, error: null });
      }
      if (table === "subcategories") {
        return createMockQuery({ data: { id: validCreatePayload.subcategory_id }, error: null });
      }
      throw new Error(`unexpected table lookup: ${table}`);
    });
  });

  it("accepts recurring template create in the allowlist", async () => {
    const result = await prepareOperation(mockClient, validUserId, op());
    expect(result.entity).toBe("recurring_transaction_templates");
    expect(result.payload).toMatchObject({ frequency: "biweekly" });
  });

  it("accepts semi_monthly recurring frequency", async () => {
    const result = await prepareOperation(mockClient, validUserId, op({
      frequency: "semi_monthly",
      day_of_month: 15,
      second_day_of_month: 30,
      day_of_week: undefined,
    }));
    expect(result.payload).toMatchObject({ frequency: "semi_monthly" });
  });

  it("accepts recurring calendar fields on create", async () => {
    const result = await prepareOperation(mockClient, validUserId, op({
      frequency: "monthly",
      interval_count: 2,
      day_of_month: 31,
      starts_on: "2026-08-01",
      ends_on: "2027-08-01",
    }));
    expect(result.payload).toMatchObject({ day_of_month: 31, interval_count: 2 });
  });

  it("rejects an out-of-range recurring calendar field on create", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ day_of_month: 32 })),
    ).rejects.toThrow("day_of_month must be between 1 and 31");
  });
});

// ---------------------------------------------------------------------------
// financial_obligations — create
// ---------------------------------------------------------------------------

describe("prepareOperation — financial_obligations create", () => {
  const validSubcategoryId = "22222222-2222-2222-2222-222222222222";
  const validCreatePayload = {
    subcategory_id: validSubcategoryId,
    recurring_template_id: null,
    name: "Rent",
    amount_centavos: 1000000,
    frequency: "monthly",
    due_day_of_month: 1,
    is_family_support: false,
    is_dependent_support: false,
    protected_by_default: true,
    starts_on: "2026-01-01",
    ends_on: null,
    notes: null,
  };

  function op(overrides: Record<string, unknown> = {}): Operation {
    return {
      operation_id: "op-1",
      entity: "financial_obligations",
      record_id: "rec-1",
      operation_type: "create",
      base_version: null,
      changed_fields: Object.keys(validCreatePayload),
      payload: { ...validCreatePayload, ...overrides },
    };
  }

  function mockValidSubcategory() {
    const result: MockQueryResult = { data: { id: validSubcategoryId }, error: null };
    mockFrom.mockReturnValue(createMockQuery(result));
  }

  it("creates a valid obligation", async () => {
    mockValidSubcategory();
    const result = await prepareOperation(mockClient, validUserId, op());
    expect(result.payload).toMatchObject({ name: "Rent", amount_centavos: 1000000 });
  });

  it("rejects missing name", async () => {
    mockValidSubcategory();
    await expect(
      prepareOperation(mockClient, validUserId, op({ name: undefined })),
    ).rejects.toThrow("name is required");
  });

  it("rejects missing subcategory_id", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ subcategory_id: undefined })),
    ).rejects.toThrow("subcategory_id is required");
  });

  it("rejects negative amount_centavos", async () => {
    mockValidSubcategory();
    await expect(
      prepareOperation(mockClient, validUserId, op({ amount_centavos: -1 })),
    ).rejects.toThrow("amount_centavos must be >= 0");
  });

  it("rejects invalid frequency", async () => {
    mockValidSubcategory();
    await expect(
      prepareOperation(mockClient, validUserId, op({ frequency: "daily" })),
    ).rejects.toThrow(/frequency must be one of/);
  });

  it("rejects inaccessible subcategory_id", async () => {
    const result: MockQueryResult = { data: null, error: null };
    mockFrom.mockReturnValue(createMockQuery(result));

    await expect(
      prepareOperation(mockClient, validUserId, op()),
    ).rejects.toThrow("subcategory_id does not reference an accessible active expense subcategory");
  });

  it("rejects due_day_of_month out of range", async () => {
    mockValidSubcategory();
    await expect(
      prepareOperation(mockClient, validUserId, op({ due_day_of_month: 0 })),
    ).rejects.toThrow("due_day_of_month must be between 1 and 31");
  });

  it("rejects starts_on > ends_on", async () => {
    mockValidSubcategory();
    await expect(
      prepareOperation(mockClient, validUserId, op({
        starts_on: "2026-12-31",
        ends_on: "2026-01-01",
      })),
    ).rejects.toThrow("starts_on must be <= ends_on");
  });
});

// ---------------------------------------------------------------------------
// financial_accounts — update
// ---------------------------------------------------------------------------

describe("prepareOperation — financial_accounts update", () => {
  function op(overrides: Record<string, unknown> = {}, fields?: string[]): Operation {
    return {
      operation_id: "op-1",
      entity: "financial_accounts",
      record_id: "rec-1",
      operation_type: "update",
      base_version: 1,
      changed_fields: fields ?? ["name", "opening_balance_centavos"],
      payload: { name: "Updated", opening_balance_centavos: 100, ...overrides },
    };
  }

  it("applies a valid update", async () => {
    const result = await prepareOperation(mockClient, validUserId, op());
    expect(result.payload).toMatchObject({ name: "Updated", opening_balance_centavos: 100 });
  });

  it("rejects status 'deleted'", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { status: "deleted" },
        ["status"],
      )),
    ).rejects.toThrow("status 'deleted' must use the delete operation");
  });

  it("rejects invalid status", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { status: "bogus" },
        ["status"],
      )),
    ).rejects.toThrow("status must be active or archived");
  });

  it("rejects negative credit_limit_centavos", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { credit_limit_centavos: -50 },
        ["credit_limit_centavos"],
      )),
    ).rejects.toThrow("credit_limit_centavos must be >= 0");
  });

  it("filters payload to changed_fields only", async () => {
    const result = await prepareOperation(mockClient, validUserId, op({
      name: "Renamed",
      kind: "e_wallet",
    }));
    expect(result.payload).not.toHaveProperty("kind");
    expect(result.payload).toHaveProperty("name", "Renamed");
  });
});

// ---------------------------------------------------------------------------
// income_sources — update
// ---------------------------------------------------------------------------

describe("prepareOperation — income_sources update", () => {
  function op(overrides: Record<string, unknown> = {}, fields?: string[]): Operation {
    return {
      operation_id: "op-1",
      entity: "income_sources",
      record_id: "rec-1",
      operation_type: "update",
      base_version: 1,
      changed_fields: fields ?? ["name", "min_amount_centavos", "max_amount_centavos"],
      payload: { name: "Updated", min_amount_centavos: 1000, max_amount_centavos: 5000, ...overrides },
    };
  }

  it("applies a valid update", async () => {
    const result = await prepareOperation(mockClient, validUserId, op());
    expect(result.payload).toMatchObject({ name: "Updated" });
  });

  it("rejects min > max on update", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { min_amount_centavos: 5000, max_amount_centavos: 1000 },
      )),
    ).rejects.toThrow("min_amount_centavos must be <= max_amount_centavos");
  });

  it("rejects negative expected_amount_centavos", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { expected_amount_centavos: -100 },
        ["expected_amount_centavos"],
      )),
    ).rejects.toThrow("expected_amount_centavos must be >= 0");
  });

  it("rejects invalid income_type on update", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { income_type: "lottery" },
        ["income_type"],
      )),
    ).rejects.toThrow("income_type must be stable or variable");
  });

  it("rejects payday_day_of_week out of range on update", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { payday_day_of_week: -1 },
        ["payday_day_of_week"],
      )),
    ).rejects.toThrow("payday_day_of_week must be between 0 and 6");
  });
});

// ---------------------------------------------------------------------------
// financial_obligations — update
// ---------------------------------------------------------------------------

describe("prepareOperation — financial_obligations update", () => {
  function op(overrides: Record<string, unknown> = {}, fields?: string[]): Operation {
    return {
      operation_id: "op-1",
      entity: "financial_obligations",
      record_id: "rec-1",
      operation_type: "update",
      base_version: 1,
      changed_fields: fields ?? ["name", "amount_centavos"],
      payload: { name: "Updated", amount_centavos: 50000, ...overrides },
    };
  }

  it("applies a valid update", async () => {
    const result = await prepareOperation(mockClient, validUserId, op());
    expect(result.payload).toMatchObject({ name: "Updated", amount_centavos: 50000 });
  });

  it("rejects negative amount_centavos", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op({ amount_centavos: -1 })),
    ).rejects.toThrow("amount_centavos must be >= 0");
  });

  it("rejects due_day_of_month out of range on update", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { due_day_of_month: 32 },
        ["due_day_of_month"],
      )),
    ).rejects.toThrow("due_day_of_month must be between 1 and 31");
  });

  it("rejects starts_on > ends_on on update", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { starts_on: "2026-12-31", ends_on: "2026-01-01" },
        ["starts_on", "ends_on"],
      )),
    ).rejects.toThrow("starts_on must be <= ends_on");
  });

  it("rejects invalid frequency on update", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op(
        { frequency: "annual" },
        ["frequency"],
      )),
    ).rejects.toThrow(/frequency must be/);
  });
});

// ---------------------------------------------------------------------------
// recurring_transaction_templates — create and update
// ---------------------------------------------------------------------------

describe("prepareOperation — recurring_transaction_templates ownership", () => {
  const payload = {
    transaction_type: "income",
    name: "Salary",
    amount_centavos: 50000,
    frequency: "monthly",
    starts_on: "2026-08-15",
    subcategory_id: "subcategory-1",
    destination_account_id: "account-1",
  };

  function op(operationType: "create" | "update", overrides: Record<string, unknown> = {}): Operation {
    const operationPayload: Record<string, unknown> = { ...payload, ...overrides };
    if (operationType === "update") delete operationPayload.transaction_type;
    return {
      operation_id: "op-1",
      entity: "recurring_transaction_templates",
      record_id: "template-1",
      operation_type: operationType,
      base_version: operationType === "update" ? 1 : null,
      changed_fields: Object.keys(operationPayload),
      payload: operationPayload,
    };
  }

  beforeEach(() => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "recurring_transaction_templates") {
        return createMockQuery({ data: {
           id: "template-1", transaction_type: "income", subcategory_id: "subcategory-1",
           source_account_id: null, destination_account_id: "account-1",
           starts_on: "2026-08-15", ends_on: "2026-09-15",
        }, error: null });
      }
      if (table === "subcategories") return createMockQuery({ data: { id: "subcategory-1" }, error: null });
      if (table === "financial_accounts") return createMockQuery({ data: { id: "account-1" }, error: null });
      throw new Error(`unexpected table lookup: ${table}`);
    });
  });

  it("requires the transaction type's matching subcategory kind on create", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op("create")),
    ).resolves.toMatchObject({ payload });
  });

  it("rejects a transfer subcategory on create", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op("create", {
        transaction_type: "transfer",
        source_account_id: "source-account",
        destination_account_id: "destination-account",
      })),
    ).rejects.toThrow("transfer templates cannot have a subcategory_id");
  });

  it("rejects a recurring-template update of transaction_type", async () => {
    const update = op("update");
    update.payload.transaction_type = "expense";
    update.changed_fields.push("transaction_type");
    await expect(
      prepareOperation(mockClient, validUserId, update),
    ).rejects.toThrow("transaction_type is immutable");
  });

  it("rejects an income template without its required destination account", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op("create", { destination_account_id: undefined })),
    ).rejects.toThrow("destination_account_id is required");
  });

  it("rejects an update that clears an effective required field", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op("update", { destination_account_id: null })),
    ).rejects.toThrow("destination_account_id is required");
  });

  it("checks ownership of foreign keys on update", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "recurring_transaction_templates") {
        return createMockQuery({ data: {
           id: "template-1", transaction_type: "income", subcategory_id: "subcategory-1",
           source_account_id: null, destination_account_id: "account-1",
           starts_on: "2026-08-15", ends_on: "2026-09-15",
        }, error: null });
      }
      if (table === "subcategories") return createMockQuery({ data: { id: "subcategory-1" }, error: null });
      return createMockQuery({ data: null, error: null });
    });

    await expect(
      prepareOperation(mockClient, validUserId, op("update", { destination_account_id: "other-account" })),
    ).rejects.toThrow("account not found or inaccessible");
  });

  it("accepts recurring calendar fields and interval on update", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op("update", {
        frequency: "weekly",
        interval_count: 2,
        day_of_week: 1,
      })),
    ).resolves.toMatchObject({
      payload: { frequency: "weekly", interval_count: 2, day_of_week: 1 },
    });
  });

  it("rejects an out-of-range recurring day_of_week on update", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op("update", { day_of_week: 7 })),
    ).rejects.toThrow("day_of_week must be between 0 and 6");
  });

  it("rejects a non-positive recurring amount on update", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op("update", { amount_centavos: 0 })),
    ).rejects.toThrow("amount_centavos must be a positive integer");
  });

  it("validates a partial recurring date update against the stored date", async () => {
    await expect(
      prepareOperation(mockClient, validUserId, op("update", { starts_on: "2026-10-01" })),
    ).rejects.toThrow("starts_on must be <= ends_on");
  });
});

// ---------------------------------------------------------------------------
// delete — all entities
// ---------------------------------------------------------------------------

describe("prepareOperation — delete", () => {
  it.each(["categories", "subcategories", "financial_accounts", "income_sources", "financial_obligations"])(
    "passes through delete for '%s' unchanged",
    async (entity) => {
      const input: Operation = {
        operation_id: "op-1",
        entity,
        record_id: "rec-1",
        operation_type: "delete",
        base_version: 2,
        changed_fields: [],
        payload: {},
      };
      const result = await prepareOperation(mockClient, validUserId, input);
      expect(result).toEqual(input);
    },
  );
});

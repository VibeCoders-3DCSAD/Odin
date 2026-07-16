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

  it.each(["categories", "subcategories", "financial_accounts", "income_sources", "financial_obligations"])(
    "accepts entity '%s'",
    async (entity) => {
      // Delete is the simplest operation — no payload validation needed.
      const result = await prepareOperation(mockClient, validUserId, {
        operation_id: "op-1",
        entity,
        record_id: "rec-1",
        operation_type: "delete",
        base_version: null,
        changed_fields: [],
        payload: {},
      });
      expect(result.entity).toBe(entity);
      expect(result.operation_type).toBe("delete");
    },
  );
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
    expected_amount_centavos: 1500000,
    min_amount_centavos: 500000,
    max_amount_centavos: 3000000,
    payday_day_of_month: 15,
    next_expected_date: "2026-08-15",
    is_active: true,
  };

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

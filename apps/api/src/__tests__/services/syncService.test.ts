import { jest } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockQuery } from "../helpers/supabase.js";
import { pushOperations } from "../../services/syncService.js";

test("pushes a linked debt payment once and converges both balances", async () => {
  const balances = { account: 10000, debt: 4000 };
  const appliedOperations = new Set<string>();
  const rpc = jest.fn(async (_name: string, args: { p_operation_id: string; p_payload: Record<string, unknown> }) => {
    if (appliedOperations.has(args.p_operation_id)) {
      return { data: [{ status: "duplicate", reason: null, current_version: 2, conflicted_fields: null }], error: null };
    }
    appliedOperations.add(args.p_operation_id);
    const amount = args.p_payload.amount_centavos as number;
    balances.account -= amount;
    balances.debt -= amount;
    return { data: [{ status: "applied", reason: null, current_version: 2, conflicted_fields: null }], error: null };
  });
  const supabase = {
    rpc,
    from: jest.fn(() => ({ insert: jest.fn(async () => ({ error: null })) })),
  } as unknown as SupabaseClient;

  const operation = {
    operation_id: "payment-operation-1",
    entity: "debt_payments",
    record_id: "payment-1",
    operation_type: "create",
    base_version: null,
    changed_fields: [],
    payload: {
      debt_account_id: "debt-1", transaction_id: "transaction-1", linked_transaction_type: "expense",
      linked_source_account_id: "account-1", linked_subcategory_id: "subcategory-1", source: "transaction",
      payment_date: "2026-08-21", amount_centavos: 1000, principal_centavos: 1000,
    },
  };
  const result = await pushOperations(supabase, "user-1", "device-1", [operation]);
  const replay = await pushOperations(supabase, "user-1", "device-1", [operation]);

  expect(result).toEqual([{ operation_id: "payment-operation-1", status: "applied", current_version: 2 }]);
  expect(replay).toEqual([{ operation_id: "payment-operation-1", status: "duplicate", current_version: 2 }]);
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(balances).toEqual({ account: 9000, debt: 3000 });
});

test("returns version conflicts with metadata", async () => {
  const rpc = jest.fn(async () => ({
    data: [{ status: "conflict", reason: "debt version changed", current_version: 3, conflicted_fields: ["name"] }],
    error: null,
  }));
  const query = {
    select() { return this; },
    eq() { return this; },
    maybeSingle: jest.fn(async () => ({ data: { preset_key: "credit_card" }, error: null })),
  };
  const supabase = {
    rpc,
    from: jest.fn(() => query),
  } as unknown as SupabaseClient;

  const result = await pushOperations(supabase, "user-1", "device-1", [{
    operation_id: "debt-operation-1", entity: "debt_accounts", record_id: "debt-1", operation_type: "update",
    base_version: 2, changed_fields: ["name"], payload: { name: "Updated debt" },
  }]);

  expect(result).toEqual([{ operation_id: "debt-operation-1", status: "conflict", reason: "debt version changed", current_version: 3, conflicted_fields: ["name"] }]);
});

test("classifies a second budget create as an active-budget conflict", async () => {
  const budgetQuery = createMockQuery({ data: { id: "existing-budget" }, error: null });
  const supabase = {
    from: jest.fn(() => budgetQuery),
  } as unknown as SupabaseClient;

  const result = await pushOperations(supabase, "user-1", "device-1", [{
    operation_id: "budget-operation-1", entity: "budgets", record_id: "budget-1", operation_type: "create",
    base_version: null, changed_fields: [],
    payload: {
      status: "draft", allocation_method: "MANUAL", periodKind: "CUSTOM", periodStart: "2026-08-01",
      periodEnd: "2026-08-10", budget_period_days: 10, totalAmountMinor: 1000, allocations: [],
    },
  }]);

  expect(result).toEqual([{ operation_id: "budget-operation-1", status: "conflict", reason: "active_budget_exists" }]);
});

import { prepareOperation } from "../../services/syncApplyOperation.js";

const PAYMENT = "5d000000-0000-4000-8000-0000000000b1";

// Accounts always resolve; a scheduled payment resolves only when it is in ownedPayments.
function createSupabaseStub(ownedPayments: string[]) {
  let table = "";
  let id: unknown;
  const query = {
    select: () => query,
    eq: (field: string, value: unknown) => { if (field === "id") id = value; return query; },
    or: () => query,
    maybeSingle: async () => ({ data: table !== "scheduled_payments" || ownedPayments.includes(id as string) ? { id } : null, error: null }),
  };
  return { from: (nextTable: string) => { table = nextTable; return query; } } as never;
}

function expense(payload: Record<string, unknown>) {
  return {
    operation_id: "operation-1", entity: "transactions", record_id: "transaction-1", operation_type: "create" as const, base_version: null, changed_fields: [],
    payload: { transaction_type: "expense", transaction_date: "2026-11-02", amount_centavos: 1000, source_account_id: "account-1", ...payload },
  };
}

describe("uncategorized expenses", () => {
  it("are rejected unless they pay a biller or remittance", async () => {
    await expect(prepareOperation(createSupabaseStub([PAYMENT]), "user-1", expense({}))).rejects.toThrow("expense requires a category unless it pays a biller or remittance");
    await expect(prepareOperation(createSupabaseStub([PAYMENT]), "user-1", expense({ client_mutation_id: "debt-payment:1" }))).rejects.toThrow("expense requires a category");
  });

  it("are rejected when the named biller belongs to someone else", async () => {
    await expect(prepareOperation(createSupabaseStub([]), "user-1", expense({ client_mutation_id: `scheduled-payment:${PAYMENT}:2026-11-02` })))
      .rejects.toThrow("biller or remittance not found or inaccessible");
  });

  it("are accepted for the user's own biller payment", async () => {
    await expect(prepareOperation(createSupabaseStub([PAYMENT]), "user-1", expense({ client_mutation_id: `scheduled-payment:${PAYMENT}:2026-11-02` })))
      .resolves.toMatchObject({ payload: { client_mutation_id: `scheduled-payment:${PAYMENT}:2026-11-02` } });
  });
});

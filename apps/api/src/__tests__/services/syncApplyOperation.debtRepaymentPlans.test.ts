import { prepareOperation } from "../../services/syncApplyOperation.js";

describe("debt repayment-plan sync validation", () => {
  it("accepts a Snowball strategy update", async () => {
    await expect(prepareOperation({} as never, "user-1", {
      operation_id: "operation-1",
      entity: "debt_strategy_preferences",
      record_id: "user-1",
      operation_type: "update",
      base_version: 1,
      changed_fields: ["strategy"],
      payload: { strategy: "snowball" },
    })).resolves.toMatchObject({ payload: { strategy: "snowball" } });
  });

  it("accepts a debt-payment update containing only changed fields", async () => {
    await expect(prepareOperation({} as never, "user-1", {
      operation_id: "operation-2",
      entity: "debt_payments",
      record_id: "payment-1",
      operation_type: "update",
      base_version: 1,
      changed_fields: ["amount_centavos", "principal_centavos", "payment_date", "notes"],
      payload: {
        debt_account_id: "debt-1",
        transaction_id: "transaction-1",
        source: "transaction",
        payment_date: "2026-09-10",
        amount_centavos: 1_000,
        principal_centavos: 1_000,
        interest_centavos: 0,
        notes: null,
        linked_transaction_type: "expense",
        linked_source_account_id: "account-1",
        linked_subcategory_id: "subcategory-1",
      },
    })).resolves.toMatchObject({
      payload: {
        amount_centavos: 1_000,
        principal_centavos: 1_000,
        payment_date: "2026-09-10",
        notes: null,
      },
    });
  });
});

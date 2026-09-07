import { prepareOperation } from "../../services/syncApplyOperation.js";

function createSupabaseStub() {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { id: "card-1" }, error: null }),
  };
  return { from: () => query } as never;
}

it("preserves transaction_id when preparing a credit-card relationship", async () => {
  const prepared = await prepareOperation(createSupabaseStub(), "user-1", {
    operation_id: "operation-1",
    entity: "credit_card_transactions",
    record_id: "transaction-1",
    operation_type: "create",
    base_version: null,
    changed_fields: ["transaction_id", "account_id", "cycle_id", "purchase_type"],
    payload: {
      transaction_id: "transaction-1",
      account_id: "card-1",
      cycle_id: "cycle-1",
      purchase_type: "regular",
    },
  });

  expect(prepared.payload).toMatchObject({
    transaction_id: "transaction-1",
    account_id: "card-1",
    cycle_id: "cycle-1",
    purchase_type: "regular",
  });
});

it("prepares every editable credit-card detail field for updates", async () => {
  const prepared = await prepareOperation(createSupabaseStub(), "user-1", {
    operation_id: "operation-2",
    entity: "credit_card_details",
    record_id: "card-1",
    operation_type: "update",
    base_version: 1,
    changed_fields: [
      "issuer", "credit_limit_centavos",
      "cutoff_day", "statement_day", "notes", "billing_cycle_days",
      "alert_threshold_percent",
    ],
    payload: {
      issuer: "Visa",
      credit_limit_centavos: 250000,
      cutoff_day: 15,
      statement_day: 5,
      notes: "Primary card",
      billing_cycle_days: 30,
      alert_threshold_percent: 80,
    },
  });

  expect(prepared.payload).toEqual({
    issuer: "Visa",
    credit_limit_centavos: 250000,
    cutoff_day: 15,
    statement_day: 5,
    notes: "Primary card",
    billing_cycle_days: 30,
    alert_threshold_percent: 80,
  });
});

import { prepareOperation } from "../../services/syncApplyOperation";

const operation = {
  operation_id: "operation-1",
  entity: "anomaly_evaluations",
  record_id: "evaluation-1",
  operation_type: "create" as const,
  base_version: null,
  changed_fields: [],
  payload: {
    transaction_id: "transaction-1",
    subcategory_id: "subcategory-1",
    amount_centavos: 100_000,
    usable_history_count: 6,
    usual_spending_centavos: 12_500,
    lower_bound_centavos: 7_500,
    upper_bound_centavos: 20_000,
    severity: 1.2,
    model_version: "personal-transaction-iqr-local-v1",
    evaluated_at: "2026-10-30T12:00:00.000Z",
  },
};

describe("anomaly evaluation sync validation", () => {
  it("accepts the immutable local IQR evaluation payload", async () => {
    await expect(prepareOperation({} as never, "user-1", operation)).resolves.toMatchObject({ payload: operation.payload });
  });

  it("rejects attempts to update evaluation scores", async () => {
    await expect(prepareOperation({} as never, "user-1", { ...operation, operation_type: "update" as const, base_version: 1, changed_fields: ["severity"], payload: { severity: 2 } })).rejects.toThrow();
  });

  it("accepts the user's recurring-spending confirmation", async () => {
    const payload = { confirmed_recurring_at: "2026-10-31T08:00:00.000Z" };
    await expect(prepareOperation({} as never, "user-1", { ...operation, operation_type: "update" as const, base_version: 1, changed_fields: ["confirmed_recurring_at"], payload })).resolves.toMatchObject({ payload });
  });

  it("rejects a recurring-spending confirmation without a timestamp", async () => {
    await expect(prepareOperation({} as never, "user-1", { ...operation, operation_type: "update" as const, base_version: 1, changed_fields: ["confirmed_recurring_at"], payload: { confirmed_recurring_at: "yes" } })).rejects.toThrow("confirmed_recurring_at must be an ISO-8601 timestamp");
  });
});

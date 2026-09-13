import { repairCreditCardPaymentCreateRows } from "../repairCreditCardPaymentCreates";

describe("repairCreditCardPaymentCreateRows", () => {
  it("refreshes a pending payment create with the edited local payment values", async () => {
    const row = {
      operation_id: "payment-create-1",
      entity: "credit_card_payments",
      record_id: "payment-1",
      operation_type: "create",
      changed_fields: JSON.stringify(["cycle_id", "amount_centavos"]),
      payload: JSON.stringify({
        cycle_id: "cycle-1",
        statement_id: "statement-1",
        transaction_id: "transaction-1",
        amount_centavos: 1_000,
        payment_date: "2026-09-01",
        source_account_id: "source-1",
        client_mutation_id: "mutation-1",
      }),
    };
    const db = {
      getFirstAsync: jest.fn(async () => ({
        cycle_id: "cycle-1",
        statement_id: "statement-1",
        transaction_id: "transaction-1",
        amount_centavos: 4_500_000,
        payment_date: "2026-09-13",
        source_account_id: "source-2",
        notes: "updated",
        client_mutation_id: "mutation-1",
      })),
      runAsync: jest.fn(async () => ({ changes: 1 })),
    };

    await repairCreditCardPaymentCreateRows(db as never, "user-1", [row]);

    expect(JSON.parse(row.payload)).toMatchObject({
      amount_centavos: 4_500_000,
      payment_date: "2026-09-13",
      source_account_id: "source-2",
      notes: "updated",
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      "UPDATE sync_queue SET payload = ?, changed_fields = ? WHERE operation_id = ?",
      row.payload,
      row.changed_fields,
      "payment-create-1",
    );
  });
});

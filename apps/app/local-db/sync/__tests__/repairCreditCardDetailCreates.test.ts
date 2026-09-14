import { repairCreditCardDetailCreateRows } from "../repairCreditCardDetailCreates";

describe("repairCreditCardDetailCreateRows", () => {
  it("removes derived available-credit fields from a failed detail create", async () => {
    const row = {
      operation_id: "card-detail-create-1",
      entity: "credit_card_details",
      operation_type: "create",
      changed_fields: JSON.stringify(["account_id", "credit_limit_centavos", "available_credit_centavos"]),
      payload: JSON.stringify({ account_id: "card-1", credit_limit_centavos: 100_000, available_credit_centavos: 100_000 }),
    };
    const db = { runAsync: jest.fn(async () => ({ changes: 1 })) };

    await repairCreditCardDetailCreateRows(db as never, [row]);

    expect(JSON.parse(row.payload)).toEqual({ account_id: "card-1", credit_limit_centavos: 100_000 });
    expect(JSON.parse(row.changed_fields)).toEqual(["account_id", "credit_limit_centavos"]);
    expect(db.runAsync).toHaveBeenCalledWith(
      "UPDATE sync_queue SET payload = ?, changed_fields = ? WHERE operation_id = ?",
      row.payload,
      row.changed_fields,
      "card-detail-create-1",
    );
  });
});

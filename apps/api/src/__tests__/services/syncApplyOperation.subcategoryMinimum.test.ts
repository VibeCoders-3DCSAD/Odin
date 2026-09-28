import { prepareOperation } from "../../services/syncApplyOperation.js";

describe("subcategory minimum sync validation", () => {
  it("accepts a nullable non-negative minimum amount update", async () => {
    await expect(prepareOperation({} as never, "user-1", {
      operation_id: "operation-1",
      entity: "subcategories",
      record_id: "subcategory-1",
      operation_type: "update",
      base_version: 1,
      changed_fields: ["minimum_amount_centavos"],
      payload: { minimum_amount_centavos: 5_000 },
    })).resolves.toMatchObject({ payload: { minimum_amount_centavos: 5_000 } });
  });
});

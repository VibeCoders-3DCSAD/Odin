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
});

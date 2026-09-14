import { prepareOperation } from "../../services/syncApplyOperation.js";

const queryResult = { maybeSingle: async () => ({ data: { id: "account-1" }, error: null }) };
const fourthFilter = { eq: () => queryResult };
const thirdFilter = { eq: () => fourthFilter };
const secondFilter = { eq: () => thirdFilter };
const firstFilter = { eq: () => secondFilter };
const ownedSavingsAccount = { from: () => ({ select: () => firstFilter }) };

const operation = {
  operation_id: "operation-1", entity: "savings_account_details", record_id: "account-1",
  operation_type: "create" as const, base_version: null,
  changed_fields: ["account_type", "interest_rate_bps", "minimum_balance_centavos"],
  payload: { account_type: "personal_savings", interest_rate_bps: 425, minimum_balance_centavos: 100_00 },
};

describe("savings account detail sync validation", () => {
  it("accepts an owned Personal Savings account detail payload", async () => {
    await expect(prepareOperation(ownedSavingsAccount as never, "user-1", operation)).resolves.toMatchObject({ payload: operation.payload });
  });

  it("rejects incomplete and unknown account detail fields", async () => {
    await expect(prepareOperation(ownedSavingsAccount as never, "user-1", { ...operation, payload: { account_type: "high_yield_savings", base_interest_rate_bps: 300 } })).rejects.toThrow("HYSA requires");
    await expect(prepareOperation(ownedSavingsAccount as never, "user-1", { ...operation, payload: { ...operation.payload, raw_interest_rate: 5 } })).rejects.toThrow("raw_interest_rate is not syncable");
  });
});

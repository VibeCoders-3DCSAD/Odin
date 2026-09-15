import { prepareOperation } from "../../services/syncApplyOperation.js";

const createOperation = {
  operation_id: "operation-1", entity: "savings_goals", record_id: "goal-1",
  operation_type: "create" as const, base_version: null,
  changed_fields: ["name", "goal_type", "target_amount_centavos", "starting_amount_centavos", "target_date", "priority", "planned_contribution_amount_centavos", "contribution_frequency", "next_contribution_date"],
  payload: { name: "Emergency Fund", goal_type: "emergency_fund", target_amount_centavos: 100_00, starting_amount_centavos: 0, target_date: "2026-12-31", priority: "high", planned_contribution_amount_centavos: 1_000, contribution_frequency: "monthly", next_contribution_date: "2026-04-30" },
};

describe("savings-goal sync validation", () => {
  it("accepts a valid create payload", async () => {
    await expect(prepareOperation({} as never, "user-1", createOperation)).resolves.toMatchObject({ payload: createOperation.payload });
  });

  it("rejects malformed savings activity payloads before database access", async () => {
    await expect(prepareOperation({} as never, "user-1", {
      ...createOperation,
      entity: "savings_goal_activities",
      payload: { savings_goal_id: "goal-1", transaction_id: "transaction-1", activity_kind: "invalid", amount_centavos: 100, activity_date: "2026-01-01" },
    })).rejects.toThrow("savings activity kind is invalid");
  });

  it("rejects invalid types and unknown fields", async () => {
    await expect(prepareOperation({} as never, "user-1", { ...createOperation, payload: { ...createOperation.payload, goal_type: "investment" } })).rejects.toThrow("goal_type is invalid");
    await expect(prepareOperation({} as never, "user-1", { ...createOperation, payload: { ...createOperation.payload, arbitrary_field: "nope" } })).rejects.toThrow("arbitrary_field is not syncable");
  });

  it("rejects invalid contribution schedules", async () => {
    await expect(prepareOperation({} as never, "user-1", { ...createOperation, payload: { ...createOperation.payload, contribution_frequency: "daily" } })).rejects.toThrow("contribution_frequency is invalid");
    await expect(prepareOperation({} as never, "user-1", { ...createOperation, payload: { ...createOperation.payload, next_contribution_date: "2027-01-01" } })).rejects.toThrow("next_contribution_date must be on or before target_date");
  });

  it("accepts changed fields only for an update", async () => {
    await expect(prepareOperation({} as never, "user-1", {
      ...createOperation, operation_type: "update", base_version: 1, changed_fields: ["target_amount_centavos"], payload: { target_amount_centavos: 200_00 },
    })).resolves.toMatchObject({ payload: { target_amount_centavos: 200_00 } });
  });

  it("accepts archive and restore lifecycle updates", async () => {
    await expect(prepareOperation({} as never, "user-1", {
      ...createOperation, operation_type: "update", base_version: 1,
      changed_fields: ["status", "archived_at"], payload: { status: "archived", archived_at: "2026-09-15T00:00:00.000Z" },
    })).resolves.toMatchObject({ payload: { status: "archived", archived_at: "2026-09-15T00:00:00.000Z" } });
  });
});

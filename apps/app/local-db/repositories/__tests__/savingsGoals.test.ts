import { createSavingsGoal, updateSavingsGoal } from "../savingsGoals";

const mockDb = {
  withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};
jest.mock("../../client", () => ({ initDatabase: async () => mockDb }));

const input = { name: "  TRAVEL  ", goalType: "custom" as const, targetAmountCentavos: 100_000, startingAmountCentavos: 0, targetDate: "2026-12-31", priority: "high" as const };

describe("savings goal names", () => {
  beforeEach(() => { jest.clearAllMocks(); mockDb.getFirstAsync.mockReset(); });

  it("rejects a duplicate before creating a goal or a sync operation", async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: "existing-goal" });
    await expect(createSavingsGoal("user-1", "device-1", input)).rejects.toMatchObject({ code: "DUPLICATE_NAME" });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining("user_id = ? AND deleted = 0"), "user-1", "TRAVEL", null, null);
    expect(mockDb.getFirstAsync.mock.calls[0][0]).toContain("lower(trim(name)) = lower(trim(?))");
  });

  it("keeps an unchanged name without conflicting with itself", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: "goal-1", name: "Travel", goal_type: "custom", target_amount_centavos: 100_000,
      starting_amount_centavos: 0, target_date: "2026-12-31", priority: "high", version: 1,
    });
    await expect(updateSavingsGoal("user-1", "device-1", "goal-1", { name: "  Travel  " })).resolves.toMatchObject({ operation: null });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
    expect(mockDb.getFirstAsync).toHaveBeenCalledTimes(1);
  });

  it("rejects renaming a goal to another goal's name", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: "goal-1", name: "Emergency", goal_type: "custom", target_amount_centavos: 100_000,
      starting_amount_centavos: 0, target_date: "2026-12-31", priority: "high", version: 1,
    }).mockResolvedValueOnce({ id: "existing-goal" });
    await expect(updateSavingsGoal("user-1", "device-1", "goal-1", { name: "Travel" })).rejects.toMatchObject({ code: "DUPLICATE_NAME" });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
    expect(mockDb.getFirstAsync).toHaveBeenLastCalledWith(expect.stringContaining("id <> ?"), "user-1", "Travel", "goal-1", "goal-1");
  });
});

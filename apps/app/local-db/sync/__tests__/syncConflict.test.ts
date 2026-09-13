import { markSyncConflict } from "../syncConflict";

describe("markSyncConflict", () => {
  it("keeps a repayment-strategy version conflict visible for resolution", async () => {
    const db = { runAsync: jest.fn(async () => ({ changes: 1 })) };

    await markSyncConflict(db, {
      operation_id: "operation-1",
      reason: "credit-card version changed",
      current_version: 3,
      conflicted_fields: ["repayment_strategy"],
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'failed', attempts = attempts + 1"),
      JSON.stringify({
        reason: "credit-card version changed",
        currentVersion: 3,
        conflictedFields: ["repayment_strategy"],
      }),
      "operation-1",
    );
  });
});

import { retryAnomalyEvaluationPulls } from "../retryAnomalyEvaluationPulls";

const confirmedAt = "2026-10-21T14:30:00.000Z";
const row = {
  id: "evaluation-1", user_id: "user-1", transaction_id: "groceries-1",
  subcategory_id: "groceries", amount_centavos: 244037,
  history_days: 24, raw_anomaly_score: 2.5,
  feature_vector: { usual_spending_centavos: 140000, lower_bound_centavos: 90000, upper_bound_centavos: 210000 },
  model_version: "personal-transaction-iqr-local-v2.4.0", evaluated_at: confirmedAt,
  confirmed_recurring_at: confirmedAt, version: 2, deleted: false,
  created_at: confirmedAt, updated_at: confirmedAt,
};

describe("retry quarantined recurring confirmations", () => {
  it("restores the confirmation and clears its failure so the advanced cursor cannot lose it", async () => {
    const db = {
      getAllAsync: jest.fn().mockResolvedValue([{ record_id: row.id, payload: JSON.stringify(row) }]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    await expect(retryAnomalyEvaluationPulls(db as never, "user-1")).resolves.toBe(1);
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining("LIMIT 500"), "user-1");
    expect(db.runAsync.mock.calls[0]).toContain(confirmedAt);
    expect(db.runAsync.mock.calls[0]).not.toContain(undefined);
    expect(db.runAsync).toHaveBeenLastCalledWith(expect.stringContaining("DELETE FROM sync_pull_failures WHERE user_id = ?"), "user-1", row.id);
  });

  it("keeps a failed row and continues restoring later confirmations", async () => {
    const db = {
      getAllAsync: jest.fn().mockResolvedValue([
        { record_id: row.id, payload: JSON.stringify(row) },
        { record_id: "evaluation-2", payload: JSON.stringify({ ...row, id: "evaluation-2" }) },
      ]),
      getFirstAsync: jest.fn().mockRejectedValueOnce(new Error("cannot apply")).mockResolvedValue(null),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    await expect(retryAnomalyEvaluationPulls(db as never, "user-1")).resolves.toBe(1);
    const deletes = db.runAsync.mock.calls.filter(([sql]) => sql.startsWith("DELETE"));
    expect(deletes).toEqual([[expect.any(String), "user-1", "evaluation-2"]]);
  });

  it("ignores malformed payloads and records outside the requested user's boundary", async () => {
    const db = {
      getAllAsync: jest.fn().mockResolvedValue([
        { record_id: row.id, payload: "invalid JSON" },
        { record_id: row.id, payload: JSON.stringify({ ...row, user_id: "other-user" }) },
        { record_id: "different-id", payload: JSON.stringify(row) },
      ]),
      getFirstAsync: jest.fn(), runAsync: jest.fn(),
    };
    await expect(retryAnomalyEvaluationPulls(db as never, "user-1")).resolves.toBe(0);
    expect(db.getFirstAsync).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});

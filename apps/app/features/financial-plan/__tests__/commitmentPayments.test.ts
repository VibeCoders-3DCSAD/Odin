import { commitmentPayments } from "../helpers/commitmentPayments";

describe("commitmentPayments", () => {
  it("marks biller occurrences paid, partially paid or unpaid against the amount due", () => {
    const rows = ["2026-10-05", "2026-10-19", "2026-10-26"].map((dueDate) => ({ scheduledPaymentId: "bill-1", amountCentavos: 500, dueDate }));
    const requirements = rows.map((row) => ({ ...row, amountCentavos: 1_000 }));
    const result = commitmentPayments(rows, requirements, { paidCentavos: { "scheduled:bill-1:2026-10-05": 1_000, "scheduled:bill-1:2026-10-19": 500 }, settledKeys: [] });

    expect([...result.values()]).toEqual([
      { paidCentavos: 1_000, dueCentavos: 1_000, status: "paid" },
      { paidCentavos: 500, dueCentavos: 1_000, status: "partial" },
      { paidCentavos: 0, dueCentavos: 1_000, status: "unpaid" },
    ]);
  });

  it("applies a goal's period contributions to its earliest occurrences first", () => {
    const rows = [{ savingsGoalId: "goal-1", amountCentavos: 1_000, dueDate: "2026-10-16" }, { savingsGoalId: "goal-1", amountCentavos: 1_000, dueDate: "2026-10-02" }, { savingsGoalId: "goal-1", amountCentavos: 1_000, dueDate: "2026-10-30" }];
    const result = commitmentPayments(rows, [], { paidCentavos: { "savings:goal-1": 1_400 }, settledKeys: [] });

    expect(result.get("savings:goal-1:2026-10-02")?.status).toBe("paid");
    expect(result.get("savings:goal-1:2026-10-16")).toEqual({ paidCentavos: 400, dueCentavos: 1_000, status: "partial" });
    expect(result.get("savings:goal-1:2026-10-30")?.status).toBe("unpaid");
  });

  it("skips rows with nothing due", () => {
    expect(commitmentPayments([{ debtAccountId: "debt-1", amountCentavos: 0, dueDate: "2026-10-10" }], [], { paidCentavos: {}, settledKeys: [] }).size).toBe(0);
  });

  it("marks a settled biller occurrence paid even when less than the amount due was paid", () => {
    const rows = [{ scheduledPaymentId: "bill-1", amountCentavos: 2_500, dueDate: "2026-10-05" }];
    const result = commitmentPayments(rows, rows, { paidCentavos: { "scheduled:bill-1:2026-10-05": 1_800 }, settledKeys: ["scheduled:bill-1:2026-10-05"] });

    expect(result.get("scheduled:bill-1:2026-10-05")).toEqual({ paidCentavos: 1_800, dueCentavos: 2_500, status: "paid" });
  });
});

import { groupFlatBalancePoints, groupMissedPaymentPoints } from "../debtForecastPresentation";

describe("groupMissedPaymentPoints", () => {
  it("groups consecutive flat missed payments without merging other events", () => {
    expect(groupMissedPaymentPoints([
      { date: "2026-09-02", balanceCentavos: 4_500_000 },
      { date: "2026-09-07", balanceCentavos: 5_000_000, eventType: "missed_payment" },
      { date: "2026-09-12", balanceCentavos: 5_000_000, eventType: "missed_payment" },
      { date: "2026-09-13", balanceCentavos: 5_000_000 },
      { date: "2026-09-17", balanceCentavos: 4_500_000 },
    ])).toEqual([{
      startIndex: 1,
      endIndex: 2,
      startDate: "2026-09-07",
      endDate: "2026-09-12",
      count: 2,
      balanceCentavos: 5_000_000,
    }]);
  });

  it("does not group missed payments across a balance change", () => {
    expect(groupMissedPaymentPoints([
      { date: "2026-09-07", balanceCentavos: 5_000_000, eventType: "missed_payment" },
      { date: "2026-09-12", balanceCentavos: 5_100_000, eventType: "missed_payment" },
    ])).toEqual([]);
  });
});

describe("groupFlatBalancePoints", () => {
  it("combines consecutive unchanged balances into a date range", () => {
    expect(groupFlatBalancePoints([
      { date: "2026-09-02", balanceCentavos: 4_500_000 },
      { date: "2026-09-07", balanceCentavos: 5_000_000 },
      { date: "2026-09-12", balanceCentavos: 5_000_000 },
      { date: "2026-10-07", balanceCentavos: 250_000 },
    ])).toEqual([{
      startIndex: 1,
      endIndex: 2,
      startDate: "2026-09-07",
      endDate: "2026-09-12",
      count: 2,
      balanceCentavos: 5_000_000,
    }]);
  });
});

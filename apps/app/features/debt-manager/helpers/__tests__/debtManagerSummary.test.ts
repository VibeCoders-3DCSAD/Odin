import { buildDebtManagerSummary } from "../debtManagerSummary";

describe("buildDebtManagerSummary", () => {
  it("combines recorded payments from both debt types into chronological daily trend points", () => {
    expect(buildDebtManagerSummary([
      { currentDebtCentavos: 12_000, state: "on_track" },
      { currentDebtCentavos: 8_000, state: "behind" },
      { currentDebtCentavos: 0, state: "paid_off" },
    ], [
      { paymentDate: "2026-09-12", debtName: "Car loan", amountCentavos: 700 },
      { paymentDate: "2026-09-10", debtName: "Visa", amountCentavos: 1_000 },
      { paymentDate: "2026-09-12", debtName: "Personal loan", amountCentavos: 300 },
      { paymentDate: "2026-09-14", debtName: "Future payment", amountCentavos: 500 },
    ], "2026-09-13")).toEqual({
      currentDebtCentavos: 20_000,
      totalPaidCentavos: 2_000,
      paymentTrend: [
        { date: "2026-09-10", debtName: "Visa", amountCentavos: 1_000 },
        { date: "2026-09-12", debtName: "Car loan", amountCentavos: 700 },
        { date: "2026-09-12", debtName: "Personal loan", amountCentavos: 300 },
      ],
      progress: { activeCount: 2, paidOffCount: 1, aheadCount: 0, onTrackCount: 1, behindCount: 1, notScheduledCount: 0 },
    });
  });

  it("keeps an empty overview explicit", () => {
    expect(buildDebtManagerSummary([], [], "2026-09-13")).toEqual({
      currentDebtCentavos: 0,
      totalPaidCentavos: 0,
      paymentTrend: [],
      progress: { activeCount: 0, paidOffCount: 0, aheadCount: 0, onTrackCount: 0, behindCount: 0, notScheduledCount: 0 },
    });
  });
});

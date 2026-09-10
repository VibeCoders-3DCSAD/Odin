import { buildDebtBalanceForecast, buildDebtForecast } from "../debtForecast";

describe("buildDebtBalanceForecast", () => {
  it("projects scheduled payments from the next future due date until payoff", () => {
    expect(buildDebtBalanceForecast({ originalBalanceCentavos: 30000, currentBalanceCentavos: 30000, minimumPaymentCentavos: 10000, nextDueDate: "2026-01-01", paymentFrequency: "monthly", targetPayoffDate: "2026-04-01", status: "active", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none", typeSpecific: { startDate: null, feesCentavos: 0, penaltyInfo: null, termMonths: null } }, "2026-01-15")).toEqual([
      { date: "2026-01-01", balanceCentavos: 30000 },
      { date: "2026-01-15", balanceCentavos: 30000 },
      { date: "2026-02-01", balanceCentavos: 20000 },
      { date: "2026-03-01", balanceCentavos: 10000 },
      { date: "2026-04-01", balanceCentavos: 0 },
    ]);
  });

  it("keeps a missed past payment node flat and contributes at the next projected node", () => {
    const points = buildDebtBalanceForecast({ originalBalanceCentavos: 30000, currentBalanceCentavos: 30000, minimumPaymentCentavos: 5000, nextDueDate: "2026-09-16", paymentFrequency: "monthly", targetPayoffDate: "2027-03-16", status: "active", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none", typeSpecific: { startDate: "2026-09-01", feesCentavos: 0, penaltyInfo: null, termMonths: null } }, "2026-09-17");
    expect(points.slice(0, 3)).toEqual([
      { date: "2026-09-16", balanceCentavos: 30000 },
      { date: "2026-09-17", balanceCentavos: 30000 },
      { date: "2026-10-16", balanceCentavos: 25000 },
    ]);
  });

  it("keeps a missed node flat until a later recorded payment reduces the balance", () => {
    const points = buildDebtBalanceForecast({ originalBalanceCentavos: 30000, currentBalanceCentavos: 25000, minimumPaymentCentavos: 5000, nextDueDate: "2026-09-16", paymentFrequency: "monthly", targetPayoffDate: "2027-03-16", status: "active", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none", typeSpecific: { startDate: "2026-09-01", feesCentavos: 0, penaltyInfo: null, termMonths: null } }, "2026-10-11", [{ paymentDate: "2026-10-10", amountCentavos: 5000 }]);
    expect(points.slice(0, 4)).toEqual([
      { date: "2026-09-16", balanceCentavos: 30000 },
      { date: "2026-10-10", balanceCentavos: 25000 },
      { date: "2026-10-11", balanceCentavos: 25000 },
      { date: "2026-10-16", balanceCentavos: 20000 },
    ]);
  });

  it("returns only the current balance when no payment schedule is available", () => {
    expect(buildDebtBalanceForecast({ originalBalanceCentavos: 30000, currentBalanceCentavos: 30000, minimumPaymentCentavos: 0, nextDueDate: null, paymentFrequency: "custom", targetPayoffDate: null, status: "active", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none", typeSpecific: { startDate: null, feesCentavos: 0, penaltyInfo: null, termMonths: null } }, "2026-01-15")).toEqual([{ date: "2026-01-15", balanceCentavos: 30000 }]);
  });

  it("adds interest on dates anchored to the debt start date", () => {
    const points = buildDebtBalanceForecast({ originalBalanceCentavos: 100000, currentBalanceCentavos: 100000, minimumPaymentCentavos: 500, nextDueDate: "2026-02-14", paymentFrequency: "monthly", targetPayoffDate: "2026-02-15", status: "active", annualInterestRateBps: 1200, interestMethod: "diminishing_balance", interestPeriod: "monthly", typeSpecific: { startDate: "2026-01-15", feesCentavos: 0, penaltyInfo: null, termMonths: null } }, "2026-01-15");
    expect(points).toEqual([{ date: "2026-01-15", balanceCentavos: 100000 }, { date: "2026-02-14", balanceCentavos: 99500 }, { date: "2026-02-15", balanceCentavos: 111440 }]);
  });

  it("extends a non-viable schedule through its target date", () => {
    const points = buildDebtBalanceForecast({ originalBalanceCentavos: 5000000, currentBalanceCentavos: 4600000, minimumPaymentCentavos: 500000, nextDueDate: "2026-09-15", paymentFrequency: "monthly", targetPayoffDate: "2026-11-18", status: "active", annualInterestRateBps: 1000, interestMethod: "flat_add_on", interestPeriod: "monthly", typeSpecific: { startDate: "2026-09-08", feesCentavos: 0, penaltyInfo: null, termMonths: null } }, "2026-09-10", [{ paymentDate: "2026-09-10", amountCentavos: 400000 }]);
    expect(points.slice(-5)).toEqual([{ date: "2026-09-15", balanceCentavos: 4100000 }, { date: "2026-10-08", balanceCentavos: 4600000 }, { date: "2026-10-15", balanceCentavos: 4100000 }, { date: "2026-11-08", balanceCentavos: 4600000 }, { date: "2026-11-15", balanceCentavos: 4100000 }]);
  });

  it("uses the highest recorded payment when it exceeds the minimum", () => {
    const points = buildDebtBalanceForecast({ originalBalanceCentavos: 30000, currentBalanceCentavos: 30000, minimumPaymentCentavos: 10000, nextDueDate: "2026-02-14", paymentFrequency: "monthly", targetPayoffDate: "2026-03-16", status: "active", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none", typeSpecific: { startDate: "2026-01-15", feesCentavos: 0, penaltyInfo: null, termMonths: null } }, "2026-01-15", [{ paymentDate: "2026-01-10", amountCentavos: 15000 }]);
    expect(points.at(-1)).toEqual({ date: "2026-03-14", balanceCentavos: 0 });
  });

  it("includes the balance after each recorded payment and the current zero balance", () => {
    expect(buildDebtBalanceForecast({ originalBalanceCentavos: 100000, currentBalanceCentavos: 0, minimumPaymentCentavos: 10000, nextDueDate: "2026-02-14", paymentFrequency: "monthly", targetPayoffDate: "2026-02-14", status: "paid_off", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none", typeSpecific: { startDate: "2026-01-01", feesCentavos: 0, penaltyInfo: null, termMonths: null } }, "2026-01-15", [{ paymentDate: "2026-01-05", amountCentavos: 40000 }, { paymentDate: "2026-01-10", amountCentavos: 60000 }])).toEqual([
      { date: "2026-01-05", balanceCentavos: 60000 },
      { date: "2026-01-10", balanceCentavos: 0 },
      { date: "2026-01-15", balanceCentavos: 0 },
    ]);
  });

  it("marks a missed-payment forecast behind when payoff moves past the target", () => {
    const forecast = buildDebtForecast({ originalBalanceCentavos: 30000, currentBalanceCentavos: 30000, minimumPaymentCentavos: 5000, nextDueDate: "2026-09-16", paymentFrequency: "monthly", targetPayoffDate: "2027-01-16", status: "active", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none", typeSpecific: { startDate: "2026-09-01", feesCentavos: 0, penaltyInfo: null, termMonths: null } }, "2026-09-17");
    expect(forecast.projectedPayoffDate).toBe("2027-03-16");
    expect(forecast.status).toBe("behind");
  });
});

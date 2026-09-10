import { buildDebtForecast } from "../debtForecast";
import { combineDebtBalanceSeries } from "../globalDebtForecast";

it("includes recorded non-credit-card payments in the total debt trend", () => {
  const debt = { originalBalanceCentavos: 30000, currentBalanceCentavos: 25000, minimumPaymentCentavos: 5000, nextDueDate: "2026-09-16", paymentFrequency: "monthly" as const, targetPayoffDate: "2027-03-16", status: "active" as const, annualInterestRateBps: 0, interestMethod: "no_interest" as const, interestPeriod: "none" as const, typeSpecific: { startDate: "2026-09-01", feesCentavos: 0, penaltyInfo: null, termMonths: null } };
  const debtPoints = buildDebtForecast(debt, "2026-10-11", [{ paymentDate: "2026-10-10", amountCentavos: 5000 }]).points;
  const total = combineDebtBalanceSeries([{ points: debtPoints }, { points: [{ date: "2026-09-16", balanceCentavos: 10000 }] }]);

  expect(total.find((point) => point.date === "2026-09-16")?.balanceCentavos).toBe(40000);
  expect(total.find((point) => point.date === "2026-10-10")?.balanceCentavos).toBe(35000);
  expect(total.find((point) => point.date === "2026-10-16")?.balanceCentavos).toBe(30000);
});

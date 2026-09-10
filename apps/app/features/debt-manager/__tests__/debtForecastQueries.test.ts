import { getDebtForecast, getDebtStatus, getForecastedPayment, getForecastedPaymentDate } from "../debtForecastQueries";

const mockGetDebtAccount = jest.fn();
const mockListDebtPayments = jest.fn();

jest.mock("../../../local-db/repositories/debtAccounts", () => ({ getDebtAccount: (...args: unknown[]) => mockGetDebtAccount(...args) }));
jest.mock("../../../local-db/repositories/debtPayments", () => ({ listDebtPayments: (...args: unknown[]) => mockListDebtPayments(...args) }));

const debt = { id: "debt-1", originalBalanceCentavos: 20000, currentBalanceCentavos: 20000, minimumPaymentCentavos: 5000, nextDueDate: "2026-09-15", paymentFrequency: "monthly", targetPayoffDate: "2026-12-15", status: "active", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none", typeSpecific: { startDate: "2026-09-01", feesCentavos: 0, penaltyInfo: null, termMonths: null } };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDebtAccount.mockResolvedValue(debt);
  mockListDebtPayments.mockResolvedValue([]);
});

it("loads a user-owned debt forecast through one query", async () => {
  await expect(getDebtForecast("user-1", "debt-1", "2026-09-10")).resolves.toMatchObject({ projectedContributionCentavos: 5000, projectedPayoffDate: "2026-12-15", status: "on_track" });
  expect(mockGetDebtAccount).toHaveBeenCalledWith("user-1", "debt-1");
  expect(mockListDebtPayments).toHaveBeenCalledWith("user-1", "debt-1");
});

it("exposes payoff date, payment, and status convenience queries", async () => {
  await expect(getForecastedPaymentDate("user-1", "debt-1", "2026-09-10")).resolves.toBe("2026-12-15");
  await expect(getForecastedPayment("user-1", "debt-1", "2026-10-15", "2026-09-10")).resolves.toBe(5000);
  await expect(getDebtStatus("user-1", "debt-1", "2026-09-10")).resolves.toBe("on_track");
});

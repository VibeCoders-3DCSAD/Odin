import React from "react";
import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import DebtManagerOverview from "../DebtManagerOverview";

const mockListFinancialAccounts = jest.fn();
const mockListDebtAccounts = jest.fn();
const mockListAllDebtPayments = jest.fn();
const mockListCreditCardCycles = jest.fn();
const mockListCreditCardCycleTransactions = jest.fn();
const mockListCreditCardStatements = jest.fn();
const mockListCreditCardPayments = jest.fn();
const mockListCreditCardInstallments = jest.fn();
const mockListCreditCardStrategies = jest.fn();
const mockGetAcceptedFinancialPlanForPeriod = jest.fn();
const mockGetFinancialPlanBudgetRemaining = jest.fn();
const mockGetDebtStrategy = jest.fn();
const mockListDebtPriorities = jest.fn();

jest.mock("../../../local-db/repositories/financialFoundations", () => ({
  listFinancialAccounts: (...args: unknown[]) => mockListFinancialAccounts(...args),
}));
jest.mock("../../../local-db/repositories/debtAccounts", () => ({
  listDebtAccounts: (...args: unknown[]) => mockListDebtAccounts(...args),
}));
jest.mock("../../../local-db/repositories/debtPayments", () => ({
  listAllDebtPayments: (...args: unknown[]) => mockListAllDebtPayments(...args),
}));
jest.mock("../../../local-db/repositories/creditCardCycles", () => ({
  listCreditCardCycles: (...args: unknown[]) => mockListCreditCardCycles(...args),
  listCreditCardCycleTransactions: (...args: unknown[]) => mockListCreditCardCycleTransactions(...args),
}));
jest.mock("../../../local-db/repositories/creditCardStatements", () => ({
  listCreditCardStatements: (...args: unknown[]) => mockListCreditCardStatements(...args),
}));
jest.mock("../../../local-db/repositories/creditCardPayments", () => ({
  listCreditCardPayments: (...args: unknown[]) => mockListCreditCardPayments(...args),
}));
jest.mock("../../../local-db/repositories/creditCardInstallments", () => ({
  listCreditCardInstallments: (...args: unknown[]) => mockListCreditCardInstallments(...args),
}));
jest.mock("../../../local-db/repositories/creditCardRepaymentPlans", () => ({
  listCreditCardStrategies: (...args: unknown[]) => mockListCreditCardStrategies(...args),
}));
jest.mock("../../../local-db/repositories/financialPlans", () => ({
  getAcceptedFinancialPlanForPeriod: (...args: unknown[]) => mockGetAcceptedFinancialPlanForPeriod(...args),
  getCurrentFinancialPlanPeriod: () => ({ start: "2026-10-01", end: "2026-10-31" }),
  getFinancialPlanBudgetRemaining: (...args: unknown[]) => mockGetFinancialPlanBudgetRemaining(...args),
}));
jest.mock("../../../local-db/repositories/debtRepaymentPlans", () => ({
  getDebtStrategy: (...args: unknown[]) => mockGetDebtStrategy(...args),
  listDebtPriorities: (...args: unknown[]) => mockListDebtPriorities(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockListFinancialAccounts.mockResolvedValue([{
    id: "card-1", name: "Visa", kind: "credit_card", status: "active", creditCardDetails: {
      creditLimitCentavos: 10_000, availableCreditCentavos: 9_000, billingCycleDays: null,
    },
  }]);
  mockListDebtAccounts.mockImplementation((_userId: string, visibility: string) => Promise.resolve(visibility === "active" ? [{
    id: "debt-1", name: "Loan", type: "personal_loan", status: "active", currentBalanceCentavos: 2_000,
    originalBalanceCentavos: 5_000, allowsExtraPayments: true, minimumPaymentCentavos: 500, paymentFrequency: "monthly", nextDueDate: "2026-10-01",
    targetPayoffDate: "2027-01-01", annualInterestRateBps: 0, interestMethod: "no_interest", interestPeriod: "none",
    typeSpecific: { startDate: "2026-09-01", feesCentavos: 0, penaltyInfo: null, termMonths: null },
  }] : []));
  mockListAllDebtPayments.mockResolvedValue([{ debt_account_id: "debt-1", payment_date: "2026-09-10", amount_centavos: 300 }]);
  mockListCreditCardPayments.mockResolvedValue([{ cycle_id: "cycle-1", payment_date: "2026-09-11", amount_centavos: 500 }]);
  mockListCreditCardCycles.mockResolvedValue([{ id: "cycle-1", account_id: "card-1" }]);
  mockListCreditCardCycleTransactions.mockResolvedValue([]);
  mockListCreditCardStatements.mockResolvedValue([]);
  mockListCreditCardInstallments.mockResolvedValue([]);
  mockListCreditCardStrategies.mockResolvedValue([]);
  mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
  mockGetFinancialPlanBudgetRemaining.mockResolvedValue(null);
  mockGetDebtStrategy.mockResolvedValue("avalanche");
  mockListDebtPriorities.mockResolvedValue([]);
});

  it("shows debt paid, progress, and recorded payment trend alongside the total debt trend", async () => {
  const view = render(<DebtManagerOverview userId="user-1" onOpenCreditCards={jest.fn()} onOpenNonCreditDebts={jest.fn()} />);

  await waitFor(() => {
    expect(view.getByText("Debt paid")).toBeTruthy();
    expect(view.getByText("PHP 8.00")).toBeTruthy();
    expect(view.getByText("REMAINING DEBT")).toBeTruthy();
    expect(within(view.getByLabelText("Debt overview summary")).getByText("PHP 30.00")).toBeTruthy();
    expect(view.getByText("Recent payments")).toBeTruthy();
    expect(view.getAllByText("Loan").length).toBeGreaterThan(0);
    expect(view.getAllByText("Visa").length).toBeGreaterThan(0);
    expect(view.getByLabelText("2026-09-10, Loan, payment made PHP 3.00")).toBeTruthy();
    expect(view.getByText("Total debt trend")).toBeTruthy();
    });
  });

  it("lists cards and loans on the overview and opens each one", async () => {
    const onOpenCard = jest.fn();
    const onOpenDebt = jest.fn();
    const view = render(<DebtManagerOverview userId="user-1" onOpenCreditCards={jest.fn()} onOpenNonCreditDebts={jest.fn()} onOpenCard={onOpenCard} onOpenDebt={onOpenDebt} />);

    await waitFor(() => expect(view.getByText("Credit cards")).toBeTruthy());
    expect(view.getByText("Loans and other debts")).toBeTruthy();
    fireEvent.press(view.getByLabelText(/^Open Visa, /));
    expect(onOpenCard).toHaveBeenCalledWith("card-1");
    fireEvent.press(view.getByLabelText(/^Open Loan, PHP 20.00 remaining/));
    expect(onOpenDebt).toHaveBeenCalledWith("debt-1");
  });

  it("shows the selected strategy without a debt budget", async () => {
    const view = render(<DebtManagerOverview userId="user-1" onOpenCreditCards={jest.fn()} onOpenNonCreditDebts={jest.fn()} />);

    await waitFor(() => expect(view.getByText("Avalanche repayment plan")).toBeTruthy());
  });

  it("shows this month's unpaid payments without requiring a Financial Plan", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-21T04:00:00Z"));
    mockListAllDebtPayments.mockResolvedValue([{
      id: "payment-1", debt_account_id: "debt-1", transaction_id: "transaction-1",
      payment_date: "2026-10-10", amount_centavos: 200, principal_centavos: 200,
      interest_centavos: 0, notes: null, version: 1,
    }]);
    try {
      const view = render(<DebtManagerOverview userId="user-1" onOpenCreditCards={jest.fn()} onOpenNonCreditDebts={jest.fn()} />);
      await waitFor(() => expect(view.getByText("Upcoming Payments")).toBeTruthy());
      expect(view.getByLabelText("Loan, due 2026-10-01, PHP 3.00 unpaid, overdue")).toBeTruthy();
      expect(view.getByText("PHP 3.00 remaining this month")).toBeTruthy();
      expect(mockListAllDebtPayments).toHaveBeenCalledWith("user-1");
    } finally {
      jest.useRealTimers();
    }
  });

  it("lists repayments reserved by the accepted Financial Plan", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({
      recommendation: {
        debtReservations: [{ debtAccountId: "debt-1", amountCentavos: 1_000, dueDate: "2026-10-01" }],
      },
    });

    const view = render(<DebtManagerOverview userId="user-1" onOpenCreditCards={jest.fn()} onOpenNonCreditDebts={jest.fn()} />);

    await waitFor(() => {
      expect(view.getByText("Financial Plan repayments")).toBeTruthy();
      expect(view.getByLabelText("Loan, PHP 10.00, due 2026-10-01")).toBeTruthy();
    });
  });

  it("uses Financial Plan surplus for an unpaid statement before rolling over to loans", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({
      recommendation: { debtReservations: [], debtSurplusCentavos: 3_000 },
    });
    mockListCreditCardStatements.mockResolvedValue([{
      id: "statement-1", cycle_id: "cycle-1", statement_date: "2020-01-01", due_date: "2020-02-01",
      statement_balance_centavos: 1_500, minimum_due_centavos: 100, authoritative: true, deleted: false,
    }]);
    mockListCreditCardPayments.mockResolvedValue([{ cycle_id: "cycle-1", statement_id: "statement-1", payment_date: "2020-01-02", amount_centavos: 500 }]);

    const view = render(<DebtManagerOverview userId="user-1" onOpenCreditCards={jest.fn()} onOpenNonCreditDebts={jest.fn()} />);

    await waitFor(() => {
      expect(view.getByText("Recommended surplus allocation")).toBeTruthy();
      expect(view.getByLabelText("Visa statement, PHP 10.00")).toBeTruthy();
      expect(view.getByLabelText("Loan, PHP 20.00")).toBeTruthy();
    });
  });

  it("shows this month's budget remaining from the accepted Financial Plan", async () => {
    const plan = { id: "plan-1", recommendation: { debtReservations: [], availableFundsCentavos: 50_000 } };
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(plan);
    mockGetFinancialPlanBudgetRemaining.mockResolvedValue(12_500);

    const view = render(<DebtManagerOverview userId="user-1" onOpenCreditCards={jest.fn()} onOpenNonCreditDebts={jest.fn()} />);

    await waitFor(() => expect(view.getByText("PHP 125.00")).toBeTruthy());
    expect(view.getByText("Budget remaining this month")).toBeTruthy();
    expect(mockGetFinancialPlanBudgetRemaining).toHaveBeenCalledWith("user-1", plan);
  });

  it("keeps the repayment plan when the budget remaining lookup fails", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({ id: "plan-1", recommendation: { debtReservations: [] } });
    mockGetFinancialPlanBudgetRemaining.mockRejectedValue(new Error("spending unavailable"));

    const view = render(<DebtManagerOverview userId="user-1" onOpenCreditCards={jest.fn()} onOpenNonCreditDebts={jest.fn()} />);

    await waitFor(() => expect(view.getByText("Unavailable")).toBeTruthy());
    expect(view.getByText("Card statement targets")).toBeTruthy();
  });

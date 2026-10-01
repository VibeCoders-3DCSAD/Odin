import { getIncomeSummary, monthlyAmountCentavos } from "../incomeSummary";
import type { DebtAccount } from "../debtAccounts";
import type { IncomeSource } from "../financialFoundations";

const incomeSource: IncomeSource = {
  id: "income-1", name: "Salary", incomeType: "stable", frequency: "semi_monthly",
  recurringTemplateId: null, destinationAccountId: "account-1", subcategoryId: "income-category",
  expectedAmountCentavos: 50_000, minAmountCentavos: null, maxAmountCentavos: null,
  paydayDayOfMonth: 15, paydaySecondDayOfMonth: 30, paydayDayOfWeek: null,
  paydaySecondDayOfWeek: null, nextExpectedDate: null, estimatedIntervalDays: null,
  isActive: true, notes: null,
};

function salaryLoan(overrides: Partial<DebtAccount> = {}): DebtAccount {
  return {
    id: "debt-1", name: "SSS Salary Loan", lenderName: "SSS", type: "salary_loan", status: "active",
    progress: "on_schedule", originalBalanceCentavos: 100_000, currentBalanceCentavos: 100_000,
    annualInterestRateBps: 600, minimumPaymentCentavos: 5_000, paymentFrequency: "monthly",
    paymentSchedule: {}, nextDueDate: "2026-10-01", maturityDate: null, targetPayoffDate: "2027-10-01",
    interestPeriod: "annual", interestMethod: "diminishing_balance", notes: null,
    typeSpecific: { startDate: "2026-01-01", feesCentavos: 0, penaltyInfo: null, termMonths: 24, salaryLoan: { provider: "sss", linkedIncomeSourceId: "income-1", repaymentMethod: "payroll_deduction", deductionAmountCentavos: 5_000, deductionSchedule: "semi_monthly" } },
    hasPaymentHistory: false, archivedAt: null, paidOffAt: null, version: 1,
    ...overrides,
  };
}

describe("income summary", () => {
  it("keeps income gross and subtracts linked payroll deductions to calculate net income", () => {
    expect(getIncomeSummary([incomeSource], [salaryLoan()])).toEqual({
      grossMonthlyCentavos: 100_000,
      salaryLoanDeductionsCentavos: 10_000,
      netMonthlyCentavos: 90_000,
    });
  });

  it("does not include manual or archived salary loans as payroll deductions", () => {
    expect(getIncomeSummary([incomeSource], [
      salaryLoan({ status: "archived" }),
      salaryLoan({ id: "debt-2", typeSpecific: { startDate: "2026-01-01", feesCentavos: 0, penaltyInfo: null, termMonths: 24, salaryLoan: { provider: "gsis", linkedIncomeSourceId: "income-1", repaymentMethod: "manual_payment", deductionAmountCentavos: 5_000, deductionSchedule: "monthly" } } }),
    ])).toEqual({ grossMonthlyCentavos: 100_000, salaryLoanDeductionsCentavos: 0, netMonthlyCentavos: 100_000 });
  });

  it("normalizes weekly amounts to a monthly estimate", () => {
    expect(monthlyAmountCentavos(10_000, "weekly")).toBe(Math.round(10_000 * 52 / 12));
  });
});

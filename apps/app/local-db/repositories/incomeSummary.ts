import type { DebtAccount, PaymentFrequency } from "./debtAccounts";
import type { IncomeFrequency, IncomeSource } from "./financialFoundations";

function monthlyMultiplier(frequency: IncomeFrequency | PaymentFrequency): number {
  switch (frequency) {
    case "weekly": return 52 / 12;
    case "biweekly": return 26 / 12;
    case "semi_monthly": return 2;
    case "quarterly": return 1 / 3;
    default: return 1;
  }
}

export function monthlyAmountCentavos(amountCentavos: number, frequency: IncomeFrequency | PaymentFrequency): number {
  return Math.round(amountCentavos * monthlyMultiplier(frequency));
}

export function getIncomeSummary(sources: IncomeSource[], debts: DebtAccount[]) {
  const activeSources = sources.filter((source) => source.isActive);
  const activeSourceIds = new Set(activeSources.map((source) => source.id));
  const grossMonthlyCentavos = activeSources.reduce(
    (total, source) => total + monthlyAmountCentavos(source.expectedAmountCentavos ?? 0, source.frequency),
    0,
  );
  const salaryLoanDeductionsCentavos = debts.reduce((total, debt) => {
    const salaryLoan = debt.typeSpecific.salaryLoan;
    if (
      debt.status !== "active"
      || debt.type !== "salary_loan"
      || salaryLoan?.repaymentMethod !== "payroll_deduction"
      || !salaryLoan.linkedIncomeSourceId
      || !activeSourceIds.has(salaryLoan.linkedIncomeSourceId)
      || !salaryLoan.deductionAmountCentavos
      || !salaryLoan.deductionSchedule
    ) return total;
    return total + monthlyAmountCentavos(salaryLoan.deductionAmountCentavos, salaryLoan.deductionSchedule);
  }, 0);

  return {
    grossMonthlyCentavos,
    salaryLoanDeductionsCentavos,
    netMonthlyCentavos: Math.max(0, grossMonthlyCentavos - salaryLoanDeductionsCentavos),
  };
}

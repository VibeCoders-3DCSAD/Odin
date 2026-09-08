import type { DebtTypePreset, InterestMethod, InterestRatePeriod, PaymentFrequency } from "../../local-db/repositories/debtAccounts";

export const DEBT_TYPE_OPTIONS: Array<{ value: DebtTypePreset; label: string }> = [
  { value: "personal_loan", label: "Personal Loan" }, { value: "salary_loan", label: "Salary Loan" },
  { value: "multipurpose_loan", label: "Multipurpose Loan" }, { value: "business_loan", label: "Business Loan" },
  { value: "auto_loan", label: "Auto Loan" }, { value: "custom_debt", label: "Custom Debt" },
];
export const PAYMENT_FREQUENCY_OPTIONS: Array<{ value: PaymentFrequency; label: string }> = [
  { value: "weekly", label: "Weekly" }, { value: "biweekly", label: "Biweekly" }, { value: "semi_monthly", label: "Semi-monthly" }, { value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "custom", label: "Custom" },
];
export const INTEREST_METHOD_OPTIONS: Array<{ value: InterestMethod; label: string }> = [
  { value: "flat_add_on", label: "Flat or Add-on" }, { value: "diminishing_balance", label: "Diminishing Balance" }, { value: "provider_calculated", label: "Provider Calculated" }, { value: "no_interest", label: "No Interest" },
];
export const INTEREST_PERIOD_OPTIONS: Array<{ value: InterestRatePeriod; label: string }> = [
  { value: "annual", label: "Annual" }, { value: "monthly", label: "Monthly" }, { value: "per_term", label: "Per term" }, { value: "none", label: "None" },
];
export const DEBT_PLACEHOLDERS = { debtName: "Enter debt name", lenderName: "Enter lender name", originalAmount: "Enter original amount", currentBalance: "Enter current balance", interestRate: "Enter interest rate", paymentAmount: "Enter payment amount", startDate: "Select start date", nextPaymentDate: "Select payment date", maturityDate: "Select maturity date", targetPayoffDate: "Select target payoff date", debtSpecificTerm: "Enter loan or installment term", notes: "Add notes", personalLoanPurpose: "Select loan purpose", salaryLinkedIncomeSource: "Select linked income source", salaryRepaymentMethod: "Select repayment method", salaryDeductionAmount: "Enter deduction amount", multipurposeLoanPurpose: "Select loan purpose or purposes", businessLoanSource: "Select linked business or income source", businessLoanPurpose: "Select business loan purpose", autoVehicleDescription: "Enter vehicle description", autoPurchasePrice: "Enter vehicle purchase price", autoDownpayment: "Enter downpayment" } as const;
export function getDebtTypeLabel(type: DebtTypePreset) { return DEBT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Custom Debt"; }

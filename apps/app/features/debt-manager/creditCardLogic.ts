export type Cycle = { id: string; cycleStartDate: string; cutoffDate: string; statementDate: string };
export type Statement = { statementBalanceMinor: number; minimumDueMinor: number; authoritative: boolean };
export type StatementPaymentStatus = "unpaid" | "fully_paid" | "minimum_satisfied" | "partially_paid" | "overpaid";

export function routePostingDate(transactionDate: string, postingDate: string | null | undefined, cycles: Cycle[]): Cycle {
  const effective = postingDate ?? transactionDate;
  const ordered = [...cycles].sort((a, b) => a.cutoffDate.localeCompare(b.cutoffDate));
  const cycle = ordered.find((item) => effective >= item.cycleStartDate && effective <= item.cutoffDate);
  if (!cycle) throw new Error("No billing cycle covers this transaction date");
  return cycle;
}

export function nextCycleAfter(cycle: Cycle): Cycle {
  const addDays = (value: string, days: number) => {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const length = Math.max(1, Math.round((Date.parse(`${cycle.cutoffDate}T00:00:00Z`) - Date.parse(`${cycle.cycleStartDate}T00:00:00Z`)) / 86400000) + 1);
  return { id: "", cycleStartDate: addDays(cycle.cutoffDate, 1), cutoffDate: addDays(cycle.cutoffDate, length), statementDate: addDays(cycle.statementDate, length) };
}

export function statementPaymentStatus(statement: Statement, paidMinor: number): StatementPaymentStatus {
  if (paidMinor === 0) return "unpaid";
  if (paidMinor > statement.statementBalanceMinor) return "overpaid";
  if (paidMinor === statement.statementBalanceMinor) return "fully_paid";
  if (paidMinor >= statement.minimumDueMinor) return "minimum_satisfied";
  return "partially_paid";
}

export function validateStatementStrategy(strategy: "pay_full" | "pay_minimum" | "custom" | undefined, customMinor: number | undefined, statement: Statement): number {
  if (!strategy) throw new Error("Choose a valid repayment strategy and payment amount before continuing.");
  if (strategy === "pay_full") return statement.statementBalanceMinor;
  if (strategy === "pay_minimum") return statement.minimumDueMinor;
  if (!Number.isInteger(customMinor) || customMinor! < statement.minimumDueMinor) throw new Error("Custom payment must meet the minimum amount due. Enter a higher amount and try again.");
  if (customMinor! >= statement.statementBalanceMinor) throw new Error("Custom payment must be less than the statement balance. Choose Pay in Full or enter a lower amount.");
  return customMinor!;
}

export function creditCardDebtBudgetTarget(statement: Statement, strategy: "pay_full" | "pay_minimum" | "custom" | undefined, customMinor?: number): number {
  return validateStatementStrategy(strategy, customMinor, statement);
}

export function creditBalance(paymentMinor: number, statementBalanceMinor: number, alreadyAppliedMinor = 0): number {
  return Math.max(0, paymentMinor - statementBalanceMinor - alreadyAppliedMinor);
}

export function installmentAmortization(
  principalMinor: number,
  termMonths: number,
  interestType: "zero_interest" | "interest_bearing",
  interestRateBps = 0,
): number {
  if (!Number.isInteger(principalMinor) || principalMinor <= 0 || !Number.isInteger(termMonths) || termMonths <= 0) throw new Error("Installment principal and term must be positive.");
  if (interestType === "zero_interest") return Math.ceil(principalMinor / termMonths);
  if (!Number.isInteger(interestRateBps) || interestRateBps < 0) throw new Error("Interest rate must be non-negative.");
  const monthlyRate = interestRateBps / 120_000;
  if (monthlyRate === 0) return Math.ceil(principalMinor / termMonths);
  return Math.ceil((principalMinor * monthlyRate) / (1 - (1 + monthlyRate) ** -termMonths));
}

export const CREDIT_CARD_MESSAGES = {
  loading: "Your credit-card information is loading. Wait a moment for the details to appear.",
  empty: "No credit cards are recorded yet. Add a credit card to track billing cycles and payments.",
  estimated: "This statement balance is an estimate. Record the bank-provided statement when it is available.",
  overpaid: "This payment created a credit balance. Apply it to a future charge only when the user or issuer confirms it.",
  settlementPending: "The early settlement request was recorded. The installment remains active until the issuer recognizes it.",
  settlementRecognized: "The installment settlement was recognized. Review the updated installment history.",
  saved: "Your credit-card changes were saved. Review the billing-cycle details before continuing.",
  error: "Your credit-card information could not be loaded or saved. Check your connection and try again.",
} as const;

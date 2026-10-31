import type { CreateCreditCardInstallmentInput, CreditCardPurchaseMetadata } from "../../../local-db/repositories/credit-cards/creditCardInstallments";
import type { InstallmentFieldErrors, InstallmentFormValue } from "../components/CreditCardInstallmentFields";
import { formatCentavosForInput, parseMoney } from "./transactionFormat";

export function emptyInstallment(): InstallmentFormValue {
  return {
    originalPrincipal: "", termMonths: "", remainingPrincipal: "", remainingMonths: "", monthlyAmortization: "",
    interestType: "zero_interest", interestRatePercent: "",
  };
}

export function installmentFromMetadata(installment: NonNullable<CreditCardPurchaseMetadata["installment"]>): InstallmentFormValue {
  return {
    originalPrincipal: formatCentavosForInput(installment.original_principal_centavos),
    termMonths: String(installment.term_months),
    remainingPrincipal: formatCentavosForInput(installment.remaining_principal_centavos),
    remainingMonths: String(installment.remaining_months),
    monthlyAmortization: formatCentavosForInput(installment.monthly_amortization_centavos),
    interestType: installment.interest_type,
    interestRatePercent: installment.interest_type === "interest_bearing" ? ((installment.interest_rate_bps ?? 0) / 100).toFixed(2) : "",
  };
}

export function buildInstallmentInput(
  installment: InstallmentFormValue,
  centavos: number,
  description: string,
): { errors: InstallmentFieldErrors } | { input: CreateCreditCardInstallmentInput } {
  const originalPrincipal = parseMoney(installment.originalPrincipal);
  const termMonths = Number.parseInt(installment.termMonths, 10);
  const remainingMonths = Number.parseInt(installment.remainingMonths, 10);
  const remainingPrincipal = parseMoney(installment.remainingPrincipal);
  const monthlyAmortization = parseMoney(installment.monthlyAmortization);
  const interestRateBps = Math.round(Number.parseFloat(installment.interestRatePercent) * 100);
  const errors: InstallmentFieldErrors = {};
  if (originalPrincipal <= 0 || originalPrincipal !== centavos) errors.originalPrincipal = "Enter the transaction amount as the original principal.";
  if (!/^\d+$/.test(installment.termMonths) || termMonths <= 0) errors.termMonths = "Enter a positive whole-number term.";
  if (!/^\d+$/.test(installment.remainingMonths) || remainingMonths < 0 || remainingMonths > termMonths) errors.remainingMonths = "Remaining months cannot exceed the term.";
  if (!installment.remainingPrincipal.trim() || remainingPrincipal < 0 || remainingPrincipal > originalPrincipal) errors.remainingPrincipal = "Enter a non-negative amount up to the original principal.";
  if (monthlyAmortization <= 0) errors.monthlyAmortization = "Enter a positive monthly amount.";
  if (installment.interestType === "interest_bearing" && (!Number.isFinite(interestRateBps) || interestRateBps < 0)) errors.interestRatePercent = "Enter a non-negative interest rate.";
  if (Object.keys(errors).length) return { errors };
  return {
    input: {
      description: description.trim(), original_principal_centavos: centavos,
      remaining_principal_centavos: remainingPrincipal, term_months: termMonths,
      remaining_months: remainingMonths, monthly_amortization_centavos: monthlyAmortization,
      interest_type: installment.interestType,
      interest_rate_bps: installment.interestType === "zero_interest" ? 0 : interestRateBps,
      settlement_status: "active",
    },
  };
}

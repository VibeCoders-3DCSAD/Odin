export const PROVISIONAL_TRACKING_LABEL = "Provisional tracking; not final budget health";

export function calculateProvisionalPercentage(actualAmountMinor: number, allocationAmountMinor: number): number {
  return allocationAmountMinor > 0 ? (actualAmountMinor / allocationAmountMinor) * 100 : 0;
}

export function calculateBudgetSpentAmount(actualAmountsMinor: number[], debtActualPaymentMinor: number): number {
  return actualAmountsMinor.reduce((total, amount) => total + amount, 0) + debtActualPaymentMinor;
}

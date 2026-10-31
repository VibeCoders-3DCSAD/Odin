import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";

export function parseMoney(value: string): number {
  const cleaned = value.replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return 0;
  const parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export function formatCentavosForInput(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function formatCurrency(amountCentavos: number): string {
  return `₱${(amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatAccountAmount(account: FinancialAccount): string {
  const amount = account.kind === "credit_card" && account.creditCardDetails
    ? account.creditCardDetails.availableCreditCentavos ?? account.creditCardDetails.creditLimitCentavos
    : account.currentBalanceCentavos;
  return `PHP ${(amount / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: Date): string {
  const today = new Date();
  if (value.toDateString() === today.toDateString()) return "Today";
  return value.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// YYYY-MM-DD in local time, the shape stored for transaction and posting dates.
export function toDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

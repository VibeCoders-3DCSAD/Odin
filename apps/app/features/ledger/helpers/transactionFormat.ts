import type { FinancialAccount } from "../../../local-db/repositories/financialFoundations";
import { formatMoney, formatPhp } from "../../../lib/format/money";
import { formatDeviceDate } from "../../../lib/dates";

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
  return formatMoney(amountCentavos, { prefix: "₱" });
}

export function formatAccountAmount(account: FinancialAccount): string {
  const amount = account.kind === "credit_card" && account.creditCardDetails
    ? account.creditCardDetails.availableCreditCentavos ?? account.creditCardDetails.creditLimitCentavos
    : account.currentBalanceCentavos;
  return formatPhp(amount);
}

export function formatDate(value: Date): string {
  const today = new Date();
  if (value.toDateString() === today.toDateString()) return "Today";
  return value.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// YYYY-MM-DD in local time, the shape stored for transaction and posting dates.
export function toDateKey(value: Date): string {
  return formatDeviceDate(value);
}

export function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

import type { SpendingRecurrence } from "../../local-db/repositories/alerts/unusualSpending";

// The answers an unusual expense can get, in the order the alert shows them. Certain months is saved as a
// yearly answer with the months chosen.
export const RECURRENCE_OPTIONS: { recurrence: SpendingRecurrence; label: string }[] = [
  { recurrence: "one_time", label: "No. This is a one time only" },
  { recurrence: "frequent", label: "Yes. I will be making this frequently" },
  { recurrence: "yearly", label: "Yes, in certain months" },
];

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "June", "June and November", or "March, June, and November".
export function monthList(months: readonly number[]): string {
  const names = months.map((month) => MONTH_NAMES[month - 1]);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function recurrenceAnswer(recurrence: SpendingRecurrence, subcategoryLabel: string, months?: readonly number[] | null): string {
  if (recurrence === "frequent") return `You marked this as frequent spending. Future ${subcategoryLabel} expenses are compared with it included.`;
  if (recurrence === "yearly" && months?.length) return `You said this comes back in ${monthList(months)}. Your forecast expects it in those months.`;
  if (recurrence === "yearly") return `You marked this as a yearly payment. Your forecast expects it again in the same month next year.`;
  return `You marked this as a one-time expense. It stays out of your usual ${subcategoryLabel} spending and your forecast.`;
}

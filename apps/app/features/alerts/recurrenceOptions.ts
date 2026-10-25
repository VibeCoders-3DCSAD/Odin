import type { SpendingRecurrence } from "../../local-db/repositories/unusualSpending";

// The answers an unusual expense can get, in the order the alert shows them.
export const RECURRENCE_OPTIONS: { recurrence: SpendingRecurrence; label: string }[] = [
  { recurrence: "one_time", label: "No. This is a one time only" },
  { recurrence: "frequent", label: "Yes. I will be making this frequently" },
  { recurrence: "yearly", label: "Yes. I do this payment yearly" },
];

export function recurrenceAnswer(recurrence: SpendingRecurrence, subcategoryLabel: string): string {
  if (recurrence === "frequent") return `You marked this as frequent spending. Future ${subcategoryLabel} expenses are compared with it included.`;
  if (recurrence === "yearly") return `You marked this as a yearly payment. Your forecast expects it again in the same month next year.`;
  return `You marked this as a one-time expense. It stays out of your usual ${subcategoryLabel} spending and your forecast.`;
}

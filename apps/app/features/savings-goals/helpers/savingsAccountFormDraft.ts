import type { GoalContributionFrequency } from "./contributionSchedule";
import { deriveGoalContributionDate } from "./contributionSchedule";
import { formatPeso } from "../../../lib/format/money";

export type SavingsFormType = "hysa" | "traditional" | "time_deposit";
export const SAVINGS_FORM_TYPES: { key: SavingsFormType; label: string; description: string }[] = [
  { key: "hysa", label: "HYSA", description: "Flexible savings with a base rate and optional active boost." },
  { key: "traditional", label: "Traditional Savings", description: "Everyday savings with a regular interest rate." },
  { key: "time_deposit", label: "Time Deposit", description: "A fixed deposit held until its maturity date." },
];
export const CONTRIBUTION_CHOICES: { key: string; label: string; frequency: GoalContributionFrequency | null }[] = [
  { key: "daily", label: "Daily", frequency: "daily" },
  { key: "weekly", label: "Weekly", frequency: "weekly" },
  { key: "semi_monthly", label: "Twice a Month", frequency: "semi_monthly" },
  { key: "monthly", label: "Monthly", frequency: "monthly" },
  { key: "none", label: "None", frequency: null },
];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const CREDIT_CHOICES = ["Daily", "Monthly", "Quarterly", "Yearly"];

export type SavingsFormDraft = {
  annualRate: string;
  creditFrequency: string;
  boosted: boolean;
  boostedRate: string;
  eligibleBalance: string;
  boostStart: string;
  boostEnd: string;
  startDate: string;
  maturityDate: string;
  withdrawalTerms: string;
  frequency: string;
  contribution: string;
  weekday: number | null;
  firstDay: string;
  secondDay: string;
  hasGoal: boolean;
  target: string;
  targetDate: string;
};
export type SavingsSharedDraft = { name: string; institution: string; balance: string; notes: string };
export type SavingsFormErrors = Record<string, string>;

export function newSavingsFormDraft(type: SavingsFormType): SavingsFormDraft {
  return { annualRate: "", creditFrequency: type === "hysa" ? "Daily" : "Monthly", boosted: false, boostedRate: "", eligibleBalance: "", boostStart: "", boostEnd: "", startDate: "", maturityDate: "", withdrawalTerms: "", frequency: "none", contribution: "", weekday: null, firstDay: "", secondDay: "", hasGoal: false, target: "", targetDate: "" };
}

function amount(value: string): number {
  return value.trim() ? Number(value.replace(/,/g, "").replace(/%$/, "")) : Number.NaN;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateSavingsFormDraft(type: SavingsFormType, shared: SavingsSharedDraft, draft: SavingsFormDraft, today: string): SavingsFormErrors {
  const errors: SavingsFormErrors = {};
  if (!shared.name.trim()) errors.name = "Enter a savings name.";
  if (!Number.isFinite(amount(shared.balance)) || amount(shared.balance) < 0 || (type === "time_deposit" && amount(shared.balance) === 0)) errors.balance = type === "time_deposit" ? "Enter a principal greater than zero." : "Enter a balance of zero or more.";
  if (!Number.isFinite(amount(draft.annualRate)) || amount(draft.annualRate) < 0) errors.annualRate = "Enter an annual rate of zero or more.";
  if (type === "time_deposit") {
    if (!isDate(draft.startDate)) errors.startDate = "Select a start date.";
    if (!isDate(draft.maturityDate) || draft.maturityDate <= draft.startDate) errors.maturityDate = "Select a maturity date after the start date.";
    return errors;
  }
  if (type === "hysa" && draft.boosted) {
    if (!Number.isFinite(amount(draft.boostedRate)) || amount(draft.boostedRate) < amount(draft.annualRate)) errors.boostedRate = "Enter a total rate at least as high as the base rate.";
    if (!Number.isFinite(amount(draft.eligibleBalance)) || amount(draft.eligibleBalance) <= 0) errors.eligibleBalance = "Enter the balance eligible for the higher rate.";
    if (!isDate(draft.boostStart)) errors.boostStart = "Select when the higher rate starts.";
    if (!isDate(draft.boostEnd) || draft.boostEnd < draft.boostStart) errors.boostEnd = "Select an end date on or after the start date.";
  }
  if (draft.frequency !== "none") {
    if (!Number.isFinite(amount(draft.contribution)) || amount(draft.contribution) < 0) errors.contribution = "Enter a contribution of zero or more.";
    try {
      deriveGoalContributionDate({ contributionFrequency: CONTRIBUTION_CHOICES.find((choice) => choice.key === draft.frequency)?.frequency ?? null, contributionDayOfWeek: draft.weekday, contributionDayOfMonth: draft.firstDay.trim() ? Number(draft.firstDay) : null, contributionSecondDayOfMonth: draft.secondDay.trim() ? Number(draft.secondDay) : null }, today);
    } catch (error) {
      errors.schedule = error instanceof Error ? error.message : "Complete the contribution schedule.";
    }
  }
  if (draft.hasGoal) {
    if (!Number.isFinite(amount(draft.target)) || amount(draft.target) <= 0) errors.target = "Enter a target greater than zero.";
    if (!isDate(draft.targetDate) || draft.targetDate < today) errors.targetDate = "Select today or a future target date.";
  }
  return errors;
}

export function contributionDescription(draft: SavingsFormDraft): string {
  if (draft.frequency === "none") return "Manual contributions";
  const timing = draft.frequency === "weekly" ? `every ${WEEKDAY_NAMES[draft.weekday ?? 0]}` : draft.frequency === "semi_monthly" ? `on days ${draft.firstDay} and ${draft.secondDay}` : draft.frequency === "monthly" ? `on day ${draft.firstDay}` : "daily";
  return `${formatDraftMoney(draft.contribution)} ${timing}`;
}

export function formatDraftMoney(value: string): string {
  return formatPeso(Math.round(amount(value) * 100));
}

export function formatDraftRate(value: string): string {
  return `${amount(value)}% p.a.`;
}

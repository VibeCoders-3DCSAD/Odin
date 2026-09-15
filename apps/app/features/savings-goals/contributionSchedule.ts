import type { SavingsActivity } from "./types";

export const GOAL_CONTRIBUTION_FREQUENCIES = [
  "weekly",
  "biweekly",
  "semi_monthly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
] as const;

export type GoalContributionFrequency = typeof GOAL_CONTRIBUTION_FREQUENCIES[number];

export type SavingsContributionSchedule = {
  plannedContributionAmountCentavos: number;
  contributionFrequency: GoalContributionFrequency | null;
  contributionIntervalCount: number | null;
  contributionDayOfMonth: number | null;
  contributionSecondDayOfMonth: number | null;
  contributionDayOfWeek: number | null;
  customIntervalDays: number | null;
  nextContributionDate: string | null;
};

export type ScheduledSavingsGoal = SavingsContributionSchedule & {
  id: string;
  status: "active" | "archived" | "deleted";
  remainingAmountCentavos: number;
  isAchieved: boolean;
  targetDate: string | null;
};

export type RequiredSavingsContribution = {
  savingsId: string;
  source: "goal" | "savings_account";
  scheduledDates: string[];
  minimumPerOccurrenceCentavos: number;
  configuredMinimumCentavos: number;
  recordedContributionCentavos: number;
  remainingRequiredCentavos: number;
};

export type RequiredSavingsContributionTotal = {
  totalRequiredCentavos: number;
  contributions: RequiredSavingsContribution[];
};

export type ScheduledSavingsAccount = SavingsContributionSchedule & {
  id: string;
};

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function addMonths(date: string, months: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next.toISOString().slice(0, 10);
}

function dateAtDay(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function validDay(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 31;
}

export function validateContributionSchedule(schedule: SavingsContributionSchedule): string | null {
  if (!Number.isSafeInteger(schedule.plannedContributionAmountCentavos) || schedule.plannedContributionAmountCentavos < 0) return "planned contribution amount must be a non-negative whole number";
  if (schedule.contributionFrequency === null || !GOAL_CONTRIBUTION_FREQUENCIES.includes(schedule.contributionFrequency)) return "contribution frequency is invalid";
  if (!schedule.nextContributionDate || !isIsoDate(schedule.nextContributionDate)) return "next contribution date must use YYYY-MM-DD format";
  const interval = schedule.contributionIntervalCount ?? 1;
  if (!Number.isSafeInteger(interval) || interval <= 0) return "contribution interval must be a positive whole number";
  if (schedule.contributionFrequency === "semi_monthly") {
    if (!validDay(schedule.contributionDayOfMonth) || !validDay(schedule.contributionSecondDayOfMonth) || schedule.contributionDayOfMonth >= schedule.contributionSecondDayOfMonth) return "semi-monthly contributions require two ascending days from 1 to 31";
  }
  if ((schedule.contributionFrequency === "monthly" || schedule.contributionFrequency === "quarterly") && schedule.contributionDayOfMonth !== null && !validDay(schedule.contributionDayOfMonth)) return "contribution day of month must be from 1 to 31";
  if ((schedule.contributionFrequency === "weekly" || schedule.contributionFrequency === "biweekly") && schedule.contributionDayOfWeek !== null && (!Number.isInteger(schedule.contributionDayOfWeek) || schedule.contributionDayOfWeek < 0 || schedule.contributionDayOfWeek > 6)) return "contribution day of week must be from 0 to 6";
  if (schedule.contributionFrequency === "custom" && (!Number.isSafeInteger(schedule.customIntervalDays) || (schedule.customIntervalDays ?? 0) <= 0)) return "custom contribution schedules require a positive interval in days";
  return null;
}

function advanceSchedule(date: string, schedule: SavingsContributionSchedule): string | null {
  const frequency = schedule.contributionFrequency;
  const interval = schedule.contributionIntervalCount ?? 1;
  if (frequency === "weekly") return addDays(date, 7 * interval);
  if (frequency === "biweekly") return addDays(date, 14 * interval);
  if (frequency === "monthly") return addMonths(date, interval);
  if (frequency === "quarterly") return addMonths(date, 3 * interval);
  if (frequency === "yearly") return addMonths(date, 12 * interval);
  if (frequency === "custom") return addDays(date, schedule.customIntervalDays!);
  if (frequency !== "semi_monthly") return null;

  const current = new Date(`${date}T00:00:00Z`);
  const first = dateAtDay(current.getUTCFullYear(), current.getUTCMonth(), schedule.contributionDayOfMonth!);
  const second = dateAtDay(current.getUTCFullYear(), current.getUTCMonth(), schedule.contributionSecondDayOfMonth!);
  if (date < first) return first;
  if (date < second) return second;
  return dateAtDay(current.getUTCFullYear(), current.getUTCMonth() + interval, schedule.contributionDayOfMonth!);
}

function scheduledDates(schedule: SavingsContributionSchedule, from: string, through: string): string[] {
  const error = validateContributionSchedule(schedule);
  if (error || !schedule.nextContributionDate || from > through) return [];
  const dates: string[] = [];
  let date = schedule.nextContributionDate;
  for (let index = 0; date <= through && index < 10_000; index += 1) {
    if (date >= from) dates.push(date);
    const next = advanceSchedule(date, schedule);
    if (!next || next <= date) break;
    date = next;
  }
  return dates;
}

function validatePeriod(periodStart: string, periodEnd: string): void {
  if (!isIsoDate(periodStart) || !isIsoDate(periodEnd)) throw new Error("periodStart and periodEnd must use valid YYYY-MM-DD dates");
  if (periodStart > periodEnd) throw new Error("periodStart must be on or before periodEnd");
}

export function getMinimumContributionPerOccurrence(goal: ScheduledSavingsGoal, asOfDate: string): number | null {
  if (!isIsoDate(asOfDate) || goal.status !== "active" || goal.isAchieved || goal.remainingAmountCentavos <= 0 || !goal.targetDate) return null;
  const dates = scheduledDates(goal, asOfDate, goal.targetDate);
  if (!dates.length) return null;
  const targetDateMinimumCentavos = Math.ceil(goal.remainingAmountCentavos / dates.length);
  return Math.max(goal.plannedContributionAmountCentavos, targetDateMinimumCentavos);
}

export function getRequiredSavingsContributions(
  periodStart: string,
  periodEnd: string,
  goals: ScheduledSavingsGoal[],
  activitiesByGoal: Map<string, SavingsActivity[]>,
): RequiredSavingsContributionTotal {
  validatePeriod(periodStart, periodEnd);
  const contributions = goals.flatMap((goal) => {
    if (goal.status !== "active" || goal.isAchieved || goal.remainingAmountCentavos <= 0 || !goal.nextContributionDate) return [];
    const minimumPerOccurrenceCentavos = getMinimumContributionPerOccurrence(goal, periodStart);
    if (minimumPerOccurrenceCentavos === null || !goal.targetDate) return [];
    const allDates = scheduledDates(goal, periodStart, goal.targetDate);
    const scheduledDatesInPeriod = allDates.filter((date) => date >= periodStart && date <= periodEnd);
    if (!scheduledDatesInPeriod.length) return [];
    const configuredMinimumCentavos = Math.min(goal.remainingAmountCentavos, minimumPerOccurrenceCentavos * scheduledDatesInPeriod.length);
    const recordedContributionCentavos = (activitiesByGoal.get(goal.id) ?? [])
      .filter((activity) => activity.kind === "contribution" && activity.activityDate >= periodStart && activity.activityDate <= periodEnd)
      .reduce((total, activity) => total + activity.amountCentavos, 0);
    const remainingRequiredCentavos = Math.max(0, configuredMinimumCentavos - recordedContributionCentavos);
    return [{ savingsId: goal.id, source: "goal" as const, scheduledDates: scheduledDatesInPeriod, minimumPerOccurrenceCentavos, configuredMinimumCentavos, recordedContributionCentavos, remainingRequiredCentavos }];
  });
  return { totalRequiredCentavos: contributions.reduce((total, contribution) => total + contribution.remainingRequiredCentavos, 0), contributions };
}

export function getRequiredSavingsAccountContributions(
  periodStart: string,
  periodEnd: string,
  accounts: ScheduledSavingsAccount[],
): RequiredSavingsContributionTotal {
  validatePeriod(periodStart, periodEnd);
  const contributions = accounts.flatMap((account) => {
    const scheduleError = validateContributionSchedule(account);
    if (scheduleError || account.plannedContributionAmountCentavos <= 0) return [];
    const scheduledDatesInPeriod = scheduledDates(account, periodStart, periodEnd);
    if (!scheduledDatesInPeriod.length) return [];
    const configuredMinimumCentavos = account.plannedContributionAmountCentavos * scheduledDatesInPeriod.length;
    return [{
      savingsId: account.id,
      source: "savings_account" as const,
      scheduledDates: scheduledDatesInPeriod,
      minimumPerOccurrenceCentavos: account.plannedContributionAmountCentavos,
      configuredMinimumCentavos,
      recordedContributionCentavos: 0,
      remainingRequiredCentavos: configuredMinimumCentavos,
    }];
  });
  return { totalRequiredCentavos: contributions.reduce((total, contribution) => total + contribution.remainingRequiredCentavos, 0), contributions };
}

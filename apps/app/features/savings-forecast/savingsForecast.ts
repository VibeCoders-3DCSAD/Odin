import type { SavingsAccountDetails } from "../../local-db/repositories/savingsAccountDetails";
import type { SavingsActivity } from "../savings-goals/types";
import { advanceContributionSchedule, type SavingsContributionSchedule, validateContributionSchedule } from "../savings-goals/contributionSchedule";

export type SavingsForecastStatus = "ahead" | "on_track" | "behind" | "projected" | "not_scheduled";
export type SavingsForecastEvent = "recorded_contribution" | "recorded_withdrawal" | "scheduled_contribution" | "interest_credit" | "current_balance";
export type SavingsForecastPoint = {
  date: string;
  balanceCentavos: number;
  event: SavingsForecastEvent;
  isForecast: boolean;
  interestCentavos?: number;
};
export type SavingsForecast = {
  points: SavingsForecastPoint[];
  projectedTargetDate: string | null;
  status: SavingsForecastStatus;
  interestExplanation: string;
};

export type SavingsForecastInput = {
  currentBalanceCentavos: number;
  startingBalanceCentavos: number;
  targetAmountCentavos?: number;
  targetDate?: string | null;
  schedule: SavingsContributionSchedule;
  activities?: SavingsActivity[];
  interestRateBps: number | null;
  details?: SavingsAccountDetails | null;
  asOf: string;
};

function addMonths(date: string, months: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return value.toISOString().slice(0, 10);
}

function nextCreditDate(date: string, details?: SavingsAccountDetails | null): string {
  if (details?.interestCreditFrequency === "quarterly") return addMonths(date, 3);
  return addMonths(date, 1);
}

function applicableRateBps(details: SavingsAccountDetails | null | undefined, date: string, balanceCentavos: number, fallbackRateBps: number | null): number {
  if (!details || details.accountType !== "high_yield_savings") return fallbackRateBps ?? 0;
  if (details.promotionalInterestRateBps !== null && details.promotionStartDate && details.promotionEndDate && date >= details.promotionStartDate && date <= details.promotionEndDate) return details.promotionalInterestRateBps;
  if (details.higherRateEligible !== true) return details.baseInterestRateBps ?? 0;
  const eligibleBalance = details.maximumEligibleBalanceCentavos === null ? balanceCentavos : Math.min(balanceCentavos, details.maximumEligibleBalanceCentavos);
  const tier = details.balanceTiers?.find((candidate) => eligibleBalance >= candidate.minimumBalanceCentavos && eligibleBalance <= candidate.maximumBalanceCentavos);
  const eligibleRateBps = tier?.interestRateBps ?? details.boostedInterestRateBps ?? details.baseInterestRateBps ?? 0;
  if (details.maximumEligibleBalanceCentavos === null || balanceCentavos <= details.maximumEligibleBalanceCentavos) return eligibleRateBps;
  const baseRateBps = details.baseInterestRateBps ?? 0;
  return Math.round((details.maximumEligibleBalanceCentavos * eligibleRateBps + (balanceCentavos - details.maximumEligibleBalanceCentavos) * baseRateBps) / balanceCentavos);
}

function estimateInterestCentavos(balanceCentavos: number, rateBps: number, from: string, to: string): number {
  const days = Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
  return Math.round(balanceCentavos * rateBps * days / 3_650_000);
}

function interestExplanation(details?: SavingsAccountDetails | null): string {
  if (!details || details.accountType !== "high_yield_savings") return "Projected interest uses the saved annual rate and monthly credited interest estimate.";
  if (details.higherRateEligible !== true) return "Projected at the HYSA base rate because higher-rate eligibility is not confirmed.";
  if (details.promotionalInterestRateBps !== null) return "Projected using active promotion dates, then the saved qualifying HYSA rate.";
  return "Projected using the saved qualifying HYSA rate, balance tiers, and eligible-balance cap.";
}

export function buildSavingsForecast(input: SavingsForecastInput): SavingsForecast {
  const points: SavingsForecastPoint[] = [];
  const actualActivities = (input.activities ?? []).filter((activity) => activity.activityDate <= input.asOf).sort((left, right) => left.activityDate.localeCompare(right.activityDate));
  let historicalBalance = input.startingBalanceCentavos;
  for (const activity of actualActivities) {
    historicalBalance += activity.kind === "contribution" ? activity.amountCentavos : -activity.amountCentavos;
    points.push({ date: activity.activityDate, balanceCentavos: Math.max(0, historicalBalance), event: activity.kind === "contribution" ? "recorded_contribution" : "recorded_withdrawal", isForecast: false });
  }
  points.push({ date: input.asOf, balanceCentavos: Math.max(0, input.currentBalanceCentavos), event: "current_balance", isForecast: false });

  if (validateContributionSchedule(input.schedule)) return { points, projectedTargetDate: null, status: "not_scheduled", interestExplanation: interestExplanation(input.details) };

  let balance = Math.max(0, input.currentBalanceCentavos);
  let contributionDate = input.schedule.nextContributionDate!;
  while (contributionDate < input.asOf) contributionDate = advanceContributionSchedule(contributionDate, input.schedule) ?? "";
  if (!contributionDate) return { points, projectedTargetDate: null, status: "not_scheduled", interestExplanation: interestExplanation(input.details) };

  const horizon = input.targetDate ?? addMonths(input.asOf, 12);
  let creditDate = nextCreditDate(input.asOf, input.details);
  let interestStartDate = input.asOf;
  let projectedTargetDate: string | null = input.targetAmountCentavos && balance >= input.targetAmountCentavos ? input.asOf : null;
  for (let index = 0; contributionDate <= horizon && index < 1_000; index += 1) {
    while (creditDate <= contributionDate) {
      const rateBps = applicableRateBps(input.details, creditDate, balance, input.interestRateBps);
      const interestCentavos = estimateInterestCentavos(balance, rateBps, interestStartDate, creditDate);
      balance += interestCentavos;
      points.push({ date: creditDate, balanceCentavos: balance, event: "interest_credit", isForecast: true, interestCentavos });
      interestStartDate = creditDate;
      creditDate = nextCreditDate(creditDate, input.details);
    }
    if (!input.targetAmountCentavos || balance < input.targetAmountCentavos) {
      balance += input.schedule.plannedContributionAmountCentavos;
      points.push({ date: contributionDate, balanceCentavos: balance, event: "scheduled_contribution", isForecast: true });
      if (input.targetAmountCentavos && balance >= input.targetAmountCentavos) projectedTargetDate = contributionDate;
    }
    contributionDate = advanceContributionSchedule(contributionDate, input.schedule) ?? "";
    if (!contributionDate) break;
  }

  const status: SavingsForecastStatus = !input.targetDate || !input.targetAmountCentavos
    ? "projected"
    : !projectedTargetDate || projectedTargetDate > input.targetDate
      ? "behind"
      : projectedTargetDate < input.targetDate ? "ahead" : "on_track";
  return { points, projectedTargetDate, status, interestExplanation: interestExplanation(input.details) };
}

import type { SavingsInterestConfiguration, SavingsInterestReference } from "@odin/savings-interest";

export function interestToday(): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function editableInterestReference(reference: SavingsInterestReference | null): SavingsInterestReference & { configuration: SavingsInterestConfiguration } {
  const legacy = reference?.schedule;
  return {
    balanceBasis: reference?.balanceBasis ?? "daily_balance", method: reference?.method ?? "compound", rateStructure: "fixed", notes: reference?.notes ?? null,
    configuration: reference?.configuration ? { ...reference.configuration, autoProject: false } : {
      version: 1, calculationFrequency: "daily", creditFrequency: legacy?.frequency ?? "monthly", creditIntervalDays: null,
      postingMode: "period_end", postingDay: null, postingDate: null, startsOn: legacy?.startsOn ?? interestToday(), startingBalanceCentavos: null,
      averagingPeriod: "calendar_month", averagingIntervalDays: null, minimumQualifyingBalanceCentavos: null, maximumInterestBearingBalanceCentavos: null,
      dayCountBasis: "actual_365", taxEnabled: true, withholdingTaxBps: legacy?.withholdingTaxBps ?? 2000,
      autoProject: false, stoppingPolicy: "preserve", showBreakdown: true, rateHistory: [],
    },
  };
}

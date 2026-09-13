import type { DebtBalanceForecastPoint } from "./debtForecast";

export type MissedPaymentGroup = {
  startIndex: number;
  endIndex: number;
  startDate: string;
  endDate: string;
  count: number;
  balanceCentavos: number;
};

function groupConsecutivePoints(points: DebtBalanceForecastPoint[], isEligible: (point: DebtBalanceForecastPoint) => boolean): MissedPaymentGroup[] {
  const groups: MissedPaymentGroup[] = [];
  let group: MissedPaymentGroup | null = null;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    if (isEligible(point) && group?.endIndex === index - 1 && group.balanceCentavos === point.balanceCentavos) {
      group.endIndex = index;
      group.endDate = point.date;
      group.count += 1;
      continue;
    }
    if (group?.count && group.count > 1) groups.push(group);
    group = isEligible(point)
      ? { startIndex: index, endIndex: index, startDate: point.date, endDate: point.date, count: 1, balanceCentavos: point.balanceCentavos }
      : null;
  }
  if (group && group.count > 1) groups.push(group);
  return groups;
}

export function groupMissedPaymentPoints(points: DebtBalanceForecastPoint[]): MissedPaymentGroup[] {
  return groupConsecutivePoints(points, (point) => point.eventType === "missed_payment");
}

export function groupFlatBalancePoints(points: DebtBalanceForecastPoint[]): MissedPaymentGroup[] {
  return groupConsecutivePoints(points, () => true);
}

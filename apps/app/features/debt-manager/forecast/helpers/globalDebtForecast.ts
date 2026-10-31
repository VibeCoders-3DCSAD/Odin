import type { DebtBalanceForecastPoint } from "./debtForecast";

export type DebtBalanceSeries = { points: DebtBalanceForecastPoint[] };

function balanceAtDate(series: DebtBalanceSeries, date: string) {
  const point = series.points.filter((item) => item.date <= date).at(-1) ?? series.points[0];
  return point?.balanceCentavos ?? 0;
}

export function combineDebtBalanceSeries(series: DebtBalanceSeries[]): DebtBalanceForecastPoint[] {
  const dates = [...new Set(series.flatMap((item) => item.points.map((point) => point.date)))].sort();
  return dates.map((date) => ({ date, balanceCentavos: series.reduce((sum, item) => sum + balanceAtDate(item, date), 0) }));
}

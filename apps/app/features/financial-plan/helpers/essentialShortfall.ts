import type { FinancialPlanAllocation } from "../types";

// Forecasts can carry fractional centavos, so the total is rounded; anything under half a centavo is no shortfall.
export function essentialShortfallCentavos(allocations: FinancialPlanAllocation[]): number {
  return Math.round(allocations.reduce((total, allocation) => {
    const required = allocation.allocationRule === "FIXED"
      ? allocation.floorAmountCentavos
      : Math.max(allocation.floorAmountCentavos, allocation.forecastAmountCentavos ?? 0);
    return total + Math.max(0, required - allocation.allocatedAmountCentavos);
  }, 0));
}

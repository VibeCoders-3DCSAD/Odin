import type { FinancialPlanAllocation } from "../types";

export function essentialShortfallCentavos(allocations: FinancialPlanAllocation[]): number {
  return allocations.reduce((total, allocation) => {
    const required = allocation.allocationRule === "FIXED"
      ? allocation.floorAmountCentavos
      : Math.max(allocation.floorAmountCentavos, allocation.forecastAmountCentavos ?? 0);
    return total + Math.max(0, required - allocation.allocatedAmountCentavos);
  }, 0);
}

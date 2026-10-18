import type { FinancialPlanAllocation } from "../types";

type AllocationGroup = {
  title: string;
  allocations: { allocation: FinancialPlanAllocation; index: number }[];
};

export function groupPlanAllocations(allocations: FinancialPlanAllocation[], restrictions?: Record<string, unknown>): AllocationGroup[] {
  const priorities = new Map<string, string>();
  const snapshotAllocations = restrictions?.allocations;
  if (Array.isArray(snapshotAllocations)) {
    for (const entry of snapshotAllocations) {
      if (!entry || typeof entry !== "object") continue;
      if (typeof entry.id === "string" && (entry.target === "category" || entry.target === "subcategory") && (entry.priorityGroup === "ESSENTIAL" || entry.priorityGroup === "NON_ESSENTIAL")) {
        priorities.set(`${entry.target}:${entry.id}`, entry.priorityGroup);
      }
    }
  }

  const groups: AllocationGroup[] = [
    { title: "Essentials", allocations: [] },
    { title: "Non-essentials", allocations: [] },
    { title: "Other allocations", allocations: [] },
  ];
  allocations.forEach((allocation, index) => {
    if (allocation.allocatedAmountCentavos === 0 && allocation.floorAmountCentavos === 0 && allocation.forecastAmountCentavos === 0 && (allocation.spentAmountCentavos ?? 0) === 0) return;
    const key = allocation.subcategoryId ? `subcategory:${allocation.subcategoryId}` : `category:${allocation.categoryId}`;
    const priority = priorities.get(key);
    const group = groups[priority === "ESSENTIAL" ? 0 : priority === "NON_ESSENTIAL" ? 1 : 2]!;
    group.allocations.push({ allocation, index });
  });
  return groups.filter((group) => group.allocations.length > 0);
}

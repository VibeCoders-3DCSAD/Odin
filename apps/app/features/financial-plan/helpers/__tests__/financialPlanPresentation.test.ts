import { allocationLabel, applyFinancialPlanLabels, commitmentStatusLabel, formatForecastPeso, formatPeso, formatPlanMonthLabel, labelWithRemovedSuffix, remainingUnallocatedCentavos, reservationLabel, toCentavos } from "../financialPlanPresentation";

describe("financial plan presentation", () => {
  it("formats centavos and uses human-readable fallback labels", () => {
    expect(formatPeso(123456)).toBe("₱1,234.56");
    expect(formatForecastPeso(123400)).toBe("₱1,234.00");
    expect(formatForecastPeso(123456)).toBe("₱1,234.56");
    expect(allocationLabel({ allocationRule: "FLEXIBLE", allocatedAmountCentavos: 0, floorAmountCentavos: 0, subcategoryId: "food" })).toBe("Expense category");
    expect(reservationLabel({ savingsGoalId: "emergency", amountCentavos: 5000 })).toBe("Savings goal");
  });

  it("applies owned reference names instead of rendering their UUIDs", () => {
    expect(applyFinancialPlanLabels({
      allocations: [{ allocationRule: "FLEXIBLE", allocatedAmountCentavos: 0, floorAmountCentavos: 0, subcategoryId: "subcategory-id" }],
      debtReservations: [{ debtAccountId: "debt-id", amountCentavos: 5000 }],
      savingsReservations: [{ savingsGoalId: "goal-id", amountCentavos: 5000 }],
    }, {
      categories: {}, subcategories: { "subcategory-id": "Groceries" }, debtAccounts: { "debt-id": "Car loan" }, savingsGoals: { "goal-id": "Emergency fund" }, creditCardStatements: {},
    })).toEqual({
      allocations: [{ allocationRule: "FLEXIBLE", allocatedAmountCentavos: 0, floorAmountCentavos: 0, subcategoryId: "subcategory-id", label: "Groceries" }],
      debtReservations: [{ debtAccountId: "debt-id", amountCentavos: 5000, label: "Car loan" }],
      savingsReservations: [{ savingsGoalId: "goal-id", amountCentavos: 5000, label: "Emergency fund" }],
    });
  });

  it("accepts only non-negative peso inputs", () => {
    expect(toCentavos("10.235")).toBe(1024);
    expect(toCentavos("-1")).toBeNull();
    expect(toCentavos("not money")).toBeNull();
  });

  it("includes category allocations and surplus reservations in the remaining amount", () => {
    expect(remainingUnallocatedCentavos(200_000, [
      { allocationRule: "FLEXIBLE", allocatedAmountCentavos: 300_000, floorAmountCentavos: 0, subcategoryId: "food" },
    ], 10_000, 20_000)).toBe(-130_000);
  });

  it("preserves the full shortfall for an infeasible plan after reservations", () => {
    const plannedCentavos = 500_000;
    const debtAndSavingsReservationsCentavos = 1_930_000;
    const categoryAllocations = [{ allocationRule: "FLEXIBLE" as const, allocatedAmountCentavos: 500_000, floorAmountCentavos: 0, subcategoryId: "fast-food" }];

    expect(remainingUnallocatedCentavos(plannedCentavos - debtAndSavingsReservationsCentavos, categoryAllocations)).toBe(-1_930_000);
  });
  it("formats a plan month label from an ISO date", () => {
    expect(formatPlanMonthLabel("2026-10-01")).toBe("October 2026");
    expect(formatPlanMonthLabel("2027-01-31")).toBe("January 2027");
    expect(formatPlanMonthLabel("not-a-date")).toBe("not-a-date");
  });

  it("describes commitment statuses without calling them missed", () => {
    expect(commitmentStatusLabel("met", "savings")).toBe("Met");
    expect(commitmentStatusLabel("partial", "debt")).toBe("Partial");
    expect(commitmentStatusLabel("not_recorded", "savings")).toBe("No contribution recorded");
    expect(commitmentStatusLabel("not_recorded", "debt")).toBe("No payment recorded");
    expect(commitmentStatusLabel("unplanned", "savings")).toBe("Additional contribution");
    expect(commitmentStatusLabel("unplanned", "debt")).toBe("Additional payment");
  });

  it("marks labels of removed entities", () => {
    expect(labelWithRemovedSuffix("Groceries", "sub-1", ["sub-1"])).toBe("Groceries (removed)");
    expect(labelWithRemovedSuffix("Groceries", "sub-2", ["sub-1"])).toBe("Groceries");
    expect(labelWithRemovedSuffix("Groceries", null, ["sub-1"])).toBe("Groceries");
    expect(labelWithRemovedSuffix("Groceries", "sub-1")).toBe("Groceries");
  });
});

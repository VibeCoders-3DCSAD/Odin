import { allocationLabel, applyFinancialPlanLabels, formatForecastPeso, formatPeso, remainingUnallocatedCentavos, reservationLabel, toCentavos } from "../financialPlanPresentation";

describe("financial plan presentation", () => {
  it("formats centavos and uses human-readable fallback labels", () => {
    expect(formatPeso(123456)).toBe("₱1,234.56");
    expect(formatForecastPeso(123400)).toBe("₱1,234");
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
});

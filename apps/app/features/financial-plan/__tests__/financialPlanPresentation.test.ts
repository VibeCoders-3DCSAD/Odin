import { allocationLabel, applyFinancialPlanLabels, formatPeso, reservationLabel, toCentavos } from "../financialPlanPresentation";

describe("financial plan presentation", () => {
  it("formats centavos and uses human-readable fallback labels", () => {
    expect(formatPeso(123456)).toBe("₱1,234.56");
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
});

import { allocationLabel, formatPeso, reservationLabel, toCentavos } from "../financialPlanPresentation";

describe("financial plan presentation", () => {
  it("formats centavos and uses stable fallback labels", () => {
    expect(formatPeso(123456)).toBe("₱1,234.56");
    expect(allocationLabel({ allocationRule: "FLEXIBLE", allocatedAmountCentavos: 0, floorAmountCentavos: 0, subcategoryId: "food" })).toBe("food");
    expect(reservationLabel({ savingsGoalId: "emergency", amountCentavos: 5000 })).toBe("emergency");
  });

  it("accepts only non-negative peso inputs", () => {
    expect(toCentavos("10.235")).toBe(1024);
    expect(toCentavos("-1")).toBeNull();
    expect(toCentavos("not money")).toBeNull();
  });
});

import { allocateDebtRepayments } from "../debtRepaymentAllocation";

const debts = [
  { id: "small", status: "active" as const, currentBalanceCentavos: 5_000, minimumPaymentCentavos: 1_000, annualInterestRateBps: 500 },
  { id: "high-rate", status: "active" as const, currentBalanceCentavos: 20_000, minimumPaymentCentavos: 1_000, annualInterestRateBps: 2_000 },
];

describe("allocateDebtRepayments", () => {
  it("uses the selected Snowball strategy after required payments", () => {
    const result = allocateDebtRepayments({ debts, debtBudgetCentavos: 7_000, strategy: "snowball" });
    expect(result.requiredPaymentCentavos).toBe(2_000);
    expect(result.allocations).toEqual(new Map([["small", 5_000], ["high-rate", 2_000]]));
  });

  it("uses the selected Avalanche strategy after required payments", () => {
    const result = allocateDebtRepayments({ debts, debtBudgetCentavos: 7_000, strategy: "avalanche" });
    expect(result.allocations).toEqual(new Map([["small", 1_000], ["high-rate", 6_000]]));
  });

  it("uses explicit priority before the selected strategy", () => {
    const result = allocateDebtRepayments({ debts, debtBudgetCentavos: 7_000, strategy: "snowball", priorities: [{ debtAccountId: "high-rate", priorityRank: 1 }] });
    expect(result.allocations).toEqual(new Map([["small", 1_000], ["high-rate", 6_000]]));
  });
});

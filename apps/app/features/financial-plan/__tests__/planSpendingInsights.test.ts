import { planSpendingInsights } from "../helpers/planSpendingInsights";
import type { FinancialPlanAllocation } from "../types";

const food: FinancialPlanAllocation = {
  categoryId: "food", label: "Food", allocationRule: "FLEXIBLE",
  allocatedAmountCentavos: 60_000, spentAmountCentavos: 15_000, floorAmountCentavos: 0,
};
const period = { start: "2026-10-01", end: "2026-10-31" };

describe("accepted plan spending insights", () => {
  it("distinguishes remaining plan money from category balances and accounts for commitments", () => {
    const messages = planSpendingInsights({ allocations: [food], spentCentavos: 15_000, period, today: "2026-10-15", funds: { remainingCentavos: 85_000, commitmentsCentavos: 40_000 } });
    expect(messages[0]).toBe("₱850.00 remains in your plan. Your budgeted commitments of ₱400.00 are already accounted for.");
    expect(messages[1]).toContain("₱450.00 remaining.");
    expect(messages).toHaveLength(4);
  });

  it("reports a negative remaining plan balance as over budget", () => {
    const messages = planSpendingInsights({ allocations: [food], spentCentavos: 15_000, period, today: "2026-10-15", funds: { remainingCentavos: -5_000, commitmentsCentavos: 0 } });
    expect(messages[0]).toBe("Your plan is ₱50.00 over budget.");
  });

  it("compares recorded spending with accepted category allocations", () => {
    const messages = planSpendingInsights({ allocations: [food], spentCentavos: 15_000, period, today: "2026-10-15" });
    expect(messages[0]).toBe("You've spent ₱150.00 of your ₱600.00 category budget (25% used). ₱450.00 remaining.");
    expect(messages).toContain("Food: ₱150.00 of ₱600.00 spent (25% used). ₱450.00 remaining.");
    expect(messages[2]).toContain("Day 15 of 31");
    expect(messages[2]).toContain("48.4%");
    expect(messages.join(" ")).not.toMatch(/on track|will|projected|forecast/i);
  });

  it("shows overspending and percentages greater than 100 instead of clamping", () => {
    const messages = planSpendingInsights({ allocations: [{ ...food, spentAmountCentavos: 75_000 }], spentCentavos: 75_000, period, today: "2026-10-15" });
    expect(messages[0]).toContain("125% used");
    expect(messages[0]).toContain("₱150.00 over budget");
    expect(messages[1]).toContain("Food:");
    expect(messages[1]).toContain("₱150.00 over budget");
  });

  it("includes and identifies spending outside the planned categories without double counting", () => {
    const messages = planSpendingInsights({ allocations: [food], spentCentavos: 20_000, period, today: "2026-10-15" });
    expect(messages[0]).toContain("₱200.00 of your ₱600.00");
    expect(messages[1]).toBe("₱50.00 of recorded spending (25%) is outside the categories in this plan.");
    expect(messages[2]).toContain("Food: ₱150.00");
    expect(messages).toHaveLength(3);
  });

  it("handles a zero category budget and spending in a zero-budget category", () => {
    const messages = planSpendingInsights({ allocations: [{ ...food, allocatedAmountCentavos: 0 }], spentCentavos: 15_000, period, today: "2026-10-15" });
    expect(messages[0]).toContain("no category budget allocated");
    expect(messages[1]).toBe("Food has ₱150.00 in recorded spending with no budget allocated.");
    expect(messages.join(" ")).not.toMatch(/Infinity|NaN/);
  });

  it("shows zero spending without assuming missing allocation progress means expenses occurred", () => {
    const messages = planSpendingInsights({ allocations: [{ ...food, spentAmountCentavos: undefined }], spentCentavos: 0, period, today: "2026-10-01" });
    expect(messages[0]).toContain("0% used");
    expect(messages[0]).toContain("₱600.00 remaining");
    expect(messages).toHaveLength(2);
  });

  it("prioritizes a category over budget before a large category still within budget", () => {
    const allocations = [
      { ...food, spentAmountCentavos: 59_000 },
      { ...food, categoryId: "transport", label: "Transport", allocatedAmountCentavos: 10_000, spentAmountCentavos: 11_000 },
    ];
    const messages = planSpendingInsights({ allocations, spentCentavos: 70_000, period, today: "2026-10-15" });
    expect(messages[1]).toContain("Transport:");
    expect(allocations[0]?.label).toBe("Food");
  });

  it.each([
    ["2026-09-30", "This plan period has not started."],
    ["2026-11-01", "This plan period has ended."],
    ["2026-10-31", "Day 31 of 31 in this plan (100% through the period)."],
  ])("handles the plan boundary at %s", (today, expected) => {
    expect(planSpendingInsights({ allocations: [], spentCentavos: 0, period, today })).toContain(expected);
  });

  it("counts leap-year plan days without timezone conversions", () => {
    const messages = planSpendingInsights({ allocations: [], spentCentavos: 0, period: { start: "2028-02-01", end: "2028-02-29" }, today: "2028-02-29" });
    expect(messages).toContain("Day 29 of 29 in this plan (100% through the period).");
  });
});

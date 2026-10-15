import { applyFinancialPlanPriorityWeights, currentCalendarMonth, excludeUnusualTransactions, financialPlanPriorityGroup, forecastCoversPlanPeriod, isFinancialPlanInfeasible, manilaToday, monthToDateSpendById, remainingCommitmentCentavos, restoreMonthToDateSpending, scheduledReservationDates, toRemainingForecast, toRemainingPlanCategory } from "../../../services/financialPlan/recommendationService.js";

describe("Financial Plan feasibility", () => {
  it("marks a 5,000-peso plan infeasible when required minimums exceed it", () => {
    expect(isFinancialPlanInfeasible(500_000, 750_000)).toBe(true);
  });

  it("keeps a plan feasible when available money exactly covers minimums", () => {
    expect(isFinancialPlanInfeasible(500_000, 500_000)).toBe(false);
  });
});

describe("Financial Plan allocation priority", () => {
  it("classifies only the configured HFCE essentials as essential", () => {
    expect(financialPlanPriorityGroup("food")).toBe("ESSENTIAL");
    expect(financialPlanPriorityGroup("recreation_culture")).toBe("NON_ESSENTIAL");
    expect(financialPlanPriorityGroup(undefined)).toBe("NON_ESSENTIAL");
  });

  it("uses clean spending shares and ignores categories whose spend was removed as unusual", () => {
    const weighted = applyFinancialPlanPriorityWeights([
      { id: "food", target: "category", priorityGroup: "ESSENTIAL", priorityWeight: 1, rule: "FLEXIBLE", floorCentavos: 0, ceilingCentavos: 1_000_000, forecastCentavos: 800_000 },
      { id: "housing", target: "category", priorityGroup: "ESSENTIAL", priorityWeight: 1, rule: "FLEXIBLE", floorCentavos: 0, ceilingCentavos: 1_000_000, forecastCentavos: 600_000 },
    ], new Map([["food", 800_000], ["housing", 0]]));

    expect(weighted.map((category) => category.priorityWeight)).toEqual([1, 0]);
  });

  it("excludes an unusual transaction before deriving category baselines", () => {
    const cleanTransactions = excludeUnusualTransactions([
      { id: "normal-food", amountCentavos: 8_000 },
      { id: "unusual-food", amountCentavos: 100_000 },
    ], new Set(["unusual-food"]));

    expect(cleanTransactions).toEqual([{ id: "normal-food", amountCentavos: 8_000 }]);
  });
});

describe("Financial Plan commitment reservations", () => {
  it("rolls a stale monthly schedule forward into the plan month", () => {
    expect(scheduledReservationDates("2026-09-15", "monthly", { start: "2026-11-01", end: "2026-11-30" })).toEqual(["2026-11-15"]);
  });

  it("includes every weekly contribution due in the plan month", () => {
    expect(scheduledReservationDates("2026-10-28", "weekly", { start: "2026-11-01", end: "2026-11-30" })).toEqual(["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"]);
  });
});

describe("Financial Plan period", () => {
  it("covers the whole Manila calendar month containing now, including mid-month", () => {
    expect(currentCalendarMonth(new Date("2026-10-15T03:00:00.000Z"))).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(currentCalendarMonth(new Date("2026-10-31T16:30:00.000Z"))).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(currentCalendarMonth(new Date("2028-02-10T00:00:00.000Z"))).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("uses an ML forecast only when it targets the plan month", () => {
    const forecast = (month: string) => ({ snapshot: { month } }) as Parameters<typeof forecastCoversPlanPeriod>[0];
    expect(forecastCoversPlanPeriod(forecast("2026-10"), { start: "2026-10-01" })).toBe(true);
    expect(forecastCoversPlanPeriod(forecast("2026-11"), { start: "2026-10-01" })).toBe(false);
  });
});

describe("Financial Plan month-to-date deductions", () => {
  const category = (id: string, target: "category" | "subcategory", rule: "FIXED" | "MINIMUM" | "FLEXIBLE", floorCentavos: number, forecastCentavos: number) => ({ id, target, priorityGroup: "ESSENTIAL" as const, priorityWeight: 1, rule, floorCentavos, ceilingCentavos: rule === "FIXED" ? floorCentavos : 100_000, forecastCentavos });
  const expense = (id: string, date: string, amount: number, extra: Record<string, unknown> = {}) => ({ id, amount_centavos: amount, transaction_date: date, transaction_type: "expense" as const, category_id: null, subcategory_id: "groceries", updated_at: date, ...extra });

  it("uses the Manila date for today", () => {
    expect(manilaToday(new Date("2026-10-14T16:30:00.000Z"))).toBe("2026-10-15");
  });

  it("deducts payments already made from a commitment", () => {
    expect(remainingCommitmentCentavos(5_000, 2_000)).toBe(3_000);
    expect(remainingCommitmentCentavos(5_000, 6_000)).toBe(0);
  });

  it("counts only this month's category spending, excluding payments, transfers and obligations", () => {
    const transactions = [
      expense("in-month", "2026-10-03", 1_000),
      expense("last-month", "2026-09-30", 9_000),
      expense("after-today", "2026-10-20", 9_000),
      expense("debt-payment", "2026-10-04", 9_000),
      expense("savings", "2026-10-05", 9_000, { destination_savings_goal_id: "goal" }),
      expense("bill", "2026-10-06", 9_000, { recurring_template_id: "rent-template" }),
      expense("parent-rollup", "2026-10-07", 500, { subcategory_id: "dining" }),
      { ...expense("income", "2026-10-08", 9_000), transaction_type: "income" as const },
    ];
    const spent = monthToDateSpendById(transactions, { start: "2026-10-01", end: "2026-10-15" }, [{ id: "groceries", target: "subcategory" }, { id: "food", target: "category" }], new Map([["groceries", "food"], ["dining", "food"]]), new Set(["debt-payment"]), new Set(["rent-template"]));
    expect(Object.fromEntries(spent)).toEqual({ groceries: 1_000, food: 500 });
  });

  it("plans only the remainder of the month and restores whole-month allocations", () => {
    const fixed = category("rent", "subcategory", "FIXED", 10_000, 10_000);
    const minimum = category("food", "category", "MINIMUM", 4_000, 6_000);
    const spentById = new Map([["rent", 10_000], ["food", 1_500]]);
    const remaining = [fixed, minimum].map((item) => toRemainingPlanCategory(item, spentById.get(item.id) ?? 0, 20_000));
    expect(remaining.map(({ floorCentavos, ceilingCentavos, forecastCentavos }) => ({ floorCentavos, ceilingCentavos, forecastCentavos }))).toEqual([
      { floorCentavos: 0, ceilingCentavos: 0, forecastCentavos: 0 },
      { floorCentavos: 2_500, ceilingCentavos: 20_000, forecastCentavos: 4_500 },
    ]);
    const optimized = [
      { allocatedAmountCentavos: 0, floorAmountCentavos: 0, ceilingAmountCentavos: 0, forecastAmountCentavos: 0 },
      { allocatedAmountCentavos: 4_500, floorAmountCentavos: 2_500, ceilingAmountCentavos: 20_000, forecastAmountCentavos: 4_500 },
    ];
    expect(restoreMonthToDateSpending(optimized, [fixed, minimum], spentById)).toEqual([
      { allocatedAmountCentavos: 10_000, floorAmountCentavos: 10_000, ceilingAmountCentavos: 10_000, forecastAmountCentavos: 10_000 },
      { allocatedAmountCentavos: 6_000, floorAmountCentavos: 4_000, ceilingAmountCentavos: 21_500, forecastAmountCentavos: 6_000 },
    ]);
  });

  it("keeps a Fixed allocation at its fixed amount when spending already exceeded it", () => {
    const fixed = category("rent", "subcategory", "FIXED", 10_000, 10_000);
    const [restored] = restoreMonthToDateSpending([{ allocatedAmountCentavos: 0, floorAmountCentavos: 0, ceilingAmountCentavos: 0, forecastAmountCentavos: 0 }], [fixed], new Map([["rent", 12_000]]));
    expect(restored?.allocatedAmountCentavos).toBe(10_000);
  });

  it("sends the optimizer only the forecast that remains this month", () => {
    const forecast = { month: "2026-10", totalAmountCentavos: 9_000, categoryForecasts: [{ category: "food", amountCentavos: 6_000 }, { category: "rent", amountCentavos: 3_000 }], modelVersion: "v1", generatedAt: "2026-10-15T00:00:00.000Z", quality: "FALLBACK" };
    const remaining = toRemainingForecast(forecast, new Map([["food", 1_500], ["rent", 5_000]]));
    expect(remaining.categoryForecasts).toEqual([{ category: "food", amountCentavos: 4_500 }, { category: "rent", amountCentavos: 0 }]);
    expect(remaining.totalAmountCentavos).toBe(4_500);
  });
});

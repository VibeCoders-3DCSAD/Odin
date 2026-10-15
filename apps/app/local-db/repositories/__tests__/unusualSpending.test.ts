import { detectUnusualSpendings, unusualSpendingStartDate } from "../unusualSpending";

const history = [100, 110, 120, 130, 140, 150].map((amount, index) => ({
  id: `history-${index}`,
  transactionDate: ["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-15", "2026-03-01", "2026-03-15"][index]!,
  amountCentavos: amount * 100,
  subcategoryId: "groceries",
  subcategoryLabel: "Groceries",
  accountName: "Cash",
}));

describe("detectUnusualSpendings", () => {
  it("flags an outlier against earlier expenses in the same subcategory", () => {
    const insights = detectUnusualSpendings([...history, { ...history[0]!, id: "spike", transactionDate: "2026-04-01", amountCentavos: 100_000 }]);

    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({ transactionId: "spike", usualSpendingCentavos: 12_500, subcategoryLabel: "Groceries" });
  });

  it("does not use other subcategories to establish an outlier baseline", () => {
    const restaurantHistory = history.map((transaction, index) => ({
      ...transaction,
      id: `restaurant-${index}`,
      subcategoryId: "restaurants",
      subcategoryLabel: "Restaurants",
    }));

    expect(detectUnusualSpendings([
      ...restaurantHistory,
      { ...history[0]!, id: "grocery-spike", transactionDate: "2026-04-01", amountCentavos: 100_000 },
    ])).toEqual([]);
  });

  it("keeps a flagged expense out of later baselines", () => {
    const spike = { ...history[0]!, id: "spike", transactionDate: "2026-04-01", amountCentavos: 100_000 };
    const repeat = { ...history[0]!, id: "repeat", transactionDate: "2026-04-02", amountCentavos: 100_000 };

    const insights = detectUnusualSpendings([...history, spike, repeat]);

    expect(insights.map((insight) => insight.transactionId)).toEqual(["spike", "repeat"]);
    expect(insights[1]).toMatchObject({ usableHistoryCount: 6, confirmedRecurring: false });
  });

  it("adds a flagged expense to the baseline once the user confirms it as frequent", () => {
    const spike = { ...history[0]!, id: "spike", transactionDate: "2026-04-01", amountCentavos: 100_000 };
    const repeat = { ...history[0]!, id: "repeat", transactionDate: "2026-04-02", amountCentavos: 100_000 };

    const unconfirmed = detectUnusualSpendings([...history, spike, repeat]);
    const confirmed = detectUnusualSpendings([...history, spike, repeat], new Set(["spike"]));

    expect(confirmed[0]).toMatchObject({ transactionId: "spike", confirmedRecurring: true });
    expect(unconfirmed[1]).toMatchObject({ transactionId: "repeat", usableHistoryCount: 6 });
    expect(confirmed[1]).toMatchObject({ transactionId: "repeat", usableHistoryCount: 7 });
    expect(confirmed[1]!.upperBoundCentavos).toBeGreaterThan(unconfirmed[1]!.upperBoundCentavos);
  });

  it("uses the previous twelve months as its history window", () => {
    expect(unusualSpendingStartDate(new Date("2026-09-23T12:00:00Z"))).toBe("2025-09-23");
  });
});

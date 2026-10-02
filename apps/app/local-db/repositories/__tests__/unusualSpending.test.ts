import { detectUnusualSpendings, unusualSpendingStartDate } from "../unusualSpending";

const history = [100, 110, 120, 130, 140, 150].map((amount, index) => ({
  id: `history-${index}`,
  transactionDate: ["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-15", "2026-03-01", "2026-03-15"][index]!,
  amountCentavos: amount * 100,
  categoryId: "food",
  subcategoryId: "groceries",
  categoryLabel: "Food",
  accountName: "Cash",
}));

describe("detectUnusualSpendings", () => {
  it("flags an outlier against earlier expenses in the same category", () => {
    const insights = detectUnusualSpendings([...history, { ...history[0]!, id: "spike", transactionDate: "2026-04-01", amountCentavos: 100_000 }]);

    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({ transactionId: "spike", usualSpendingCentavos: 12_500, categoryLabel: "Food" });
  });

  it("uses the previous twelve months as its history window", () => {
    expect(unusualSpendingStartDate(new Date("2026-09-23T12:00:00Z"))).toBe("2025-09-23");
  });
});

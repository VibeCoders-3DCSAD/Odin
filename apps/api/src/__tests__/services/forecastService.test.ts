import {
  buildEmptyForecast,
  buildForecast,
  type ForecastTransaction,
} from "../../services/forecastService";

const NOW = new Date("2026-08-15T12:00:00");

function tx(overrides: Partial<ForecastTransaction> & { transaction_date: string }): ForecastTransaction {
  return {
    transaction_type: "expense",
    amount_centavos: 1_000,
    subcategory_label: null,
    ...overrides,
  };
}

describe("buildForecast", () => {
  it("projects next-period balances from a 3-month average", () => {
    const result = buildForecast({
      openingBalanceCentavos: 1_000_000,
      now: NOW,
      transactions: [
        tx({ transaction_type: "income", amount_centavos: 2_000_000, transaction_date: "2026-05-15" }),
        tx({ transaction_type: "income", amount_centavos: 2_000_000, transaction_date: "2026-06-15" }),
        tx({ transaction_type: "income", amount_centavos: 2_000_000, transaction_date: "2026-07-15" }),
        tx({ transaction_type: "expense", amount_centavos: 600_000, transaction_date: "2026-05-10", subcategory_label: "Food" }),
        tx({ transaction_type: "expense", amount_centavos: 600_000, transaction_date: "2026-06-10", subcategory_label: "Food" }),
        tx({ transaction_type: "expense", amount_centavos: 600_000, transaction_date: "2026-07-10", subcategory_label: "Food" }),
        tx({ transaction_type: "expense", amount_centavos: 300_000, transaction_date: "2026-05-20", subcategory_label: "Transport" }),
        tx({ transaction_type: "expense", amount_centavos: 300_000, transaction_date: "2026-06-20", subcategory_label: "Transport" }),
        tx({ transaction_type: "expense", amount_centavos: 300_000, transaction_date: "2026-07-20", subcategory_label: "Transport" }),
      ],
    });

    expect(result.income_centavos).toBe(2_000_000);
    expect(result.expense_centavos).toBe(900_000);
    expect(result.projected_balance_centavos).toBe(2_100_000);
    expect(result.categories).toEqual([
      { label: "Food", amount_centavos: 600_000 },
      { label: "Transport", amount_centavos: 300_000 },
    ]);
    expect(result.period).toBe("end of September 2026");
    expect(result.confidence).toBe("Personalized estimate");
    expect(result.freshness).toBe("As of Aug 15, 2026");
    expect(result.expected_events).toEqual([]);
    expect(result.horizons.map((horizon) => horizon.key)).toEqual(["next_day", "weekly", "monthly", "yearly"]);
    expect(result.horizons.find((horizon) => horizon.key === "weekly")?.points).toHaveLength(7);
    expect(result.horizons.find((horizon) => horizon.key === "yearly")?.points).toHaveLength(12);
    expect(result.insights[0]).toBe("You are projected to save PHP 11,000 this period.");
    expect(result.insights[1]).toBe("Largest forecasted expense is Food at PHP 6,000.");
  });

  it("excludes transfers and downgrades confidence on partial coverage", () => {
    const result = buildForecast({
      openingBalanceCentavos: 0,
      now: NOW,
      transactions: [
        tx({ transaction_type: "income", amount_centavos: 600_000, transaction_date: "2026-05-01" }),
        tx({ transaction_type: "income", amount_centavos: 600_000, transaction_date: "2026-06-01" }),
        tx({ transaction_type: "expense", amount_centavos: 300_000, transaction_date: "2026-05-05", subcategory_label: "Food" }),
        tx({ transaction_type: "expense", amount_centavos: 300_000, transaction_date: "2026-06-05", subcategory_label: "Food" }),
        tx({ transaction_type: "expense", amount_centavos: 300_000, transaction_date: "2026-06-06", subcategory_label: "Food" }),
        tx({ transaction_type: "transfer", amount_centavos: 90, transaction_date: "2026-06-07", subcategory_label: "Savings" }),
      ],
    });

    expect(result.income_centavos).toBe(400_000);
    expect(result.expense_centavos).toBe(300_000);
    expect(result.projected_balance_centavos).toBe(100_000);
    expect(result.categories.some((category) => category.label === "Savings")).toBe(false);
    expect(result.confidence).toBe("Fallback estimate");
    expect(result.insights[0]).toBe("You are projected to save PHP 1,000 this period.");
    expect(result.insights[1]).toBe("Largest forecasted expense is Food at PHP 3,000.");
    expect(result.insights[2]).toContain("limited transaction history");
  });

  it("returns cold-start data when transactions exist but fall outside the window", () => {
    const result = buildForecast({
      openingBalanceCentavos: 5_000_000,
      now: NOW,
      transactions: [
        tx({ transaction_type: "expense", amount_centavos: 1_000, transaction_date: "2026-01-05" }),
      ],
    });

    expect(result.projected_balance_centavos).toBeNull();
    expect(result.income_centavos).toBeNull();
    expect(result.expense_centavos).toBeNull();
    expect(result.text).toBeNull();
    expect(result.confidence).toBe("Cold-start estimate");
  });

  it("returns the empty contract for no history", () => {
    const result = buildForecast({ openingBalanceCentavos: 0, now: NOW, transactions: [] });

    expect(result).toEqual(buildEmptyForecast());
    expect(buildEmptyForecast()).toEqual({
      projected_balance_centavos: null,
      income_centavos: null,
      expense_centavos: null,
      categories: [],
      expected_events: [],
      insights: [],
      text: null,
      period: null,
      freshness: null,
      confidence: "Cold-start estimate",
      horizons: [],
    });
  });
});

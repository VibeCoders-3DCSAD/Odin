import { detectRecurringPayments } from "@odin/spending-insights";
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
    const confirmed = detectUnusualSpendings([...history, spike, repeat], new Map([["spike", "frequent" as const]]));

    expect(confirmed[0]).toMatchObject({ transactionId: "spike", confirmedRecurring: true });
    expect(unconfirmed[1]).toMatchObject({ transactionId: "repeat", usableHistoryCount: 6 });
    expect(confirmed[1]).toMatchObject({ transactionId: "repeat", usableHistoryCount: 7 });
    expect(confirmed[1]!.upperBoundCentavos).toBeGreaterThan(unconfirmed[1]!.upperBoundCentavos);
  });

  it("keeps a yearly or one-time expense out of the baseline but reports the answer", () => {
    const spike = { ...history[0]!, id: "spike", transactionDate: "2026-04-01", amountCentavos: 100_000 };
    const repeat = { ...history[0]!, id: "repeat", transactionDate: "2026-04-02", amountCentavos: 100_000 };

    for (const recurrence of ["yearly", "one_time"] as const) {
      const insights = detectUnusualSpendings([...history, spike, repeat], new Map([["spike", recurrence]]));

      expect(insights[0]).toMatchObject({ transactionId: "spike", recurrence, confirmedRecurring: false });
      expect(insights[1]).toMatchObject({ transactionId: "repeat", usableHistoryCount: 6, recurrence: null });
    }
  });

  it("uses the previous thirteen months as its history window", () => {
    expect(unusualSpendingStartDate(new Date("2026-09-23T12:00:00Z"))).toBe("2025-08-23");
  });

  describe("yearly expenses", () => {
    const gifts = { ...history[0]!, id: "gifts-2026", transactionDate: "2026-04-01", amountCentavos: 100_000 };
    const yearly = new Map([["gifts-2026", "yearly" as const]]);
    const nextYear = (amountCentavos: number, transactionDate = "2027-04-10") => ({ ...history[0]!, id: "gifts-2027", transactionDate, amountCentavos });

    it("raises the upper bound to 1.5x last year's amount around its anniversary", () => {
      expect(detectUnusualSpendings([...history, gifts, nextYear(140_000)], yearly).map((insight) => insight.transactionId)).toEqual(["gifts-2026"]);
    });

    it("still flags an expense well above last year's yearly amount", () => {
      const insights = detectUnusualSpendings([...history, gifts, nextYear(200_000)], yearly);

      expect(insights.map((insight) => insight.transactionId)).toEqual(["gifts-2026", "gifts-2027"]);
      expect(insights[1]!.upperBoundCentavos).toBe(150_000);
    });

    it("keeps the usual range outside the anniversary window", () => {
      expect(detectUnusualSpendings([...history, gifts, nextYear(140_000, "2026-10-01")], yearly).map((insight) => insight.transactionId)).toEqual(["gifts-2026", "gifts-2027"]);
    });

    it("carries the yearly allowance forward without another answer and keeps it out of the baseline", () => {
      const followingYear = { ...history[0]!, id: "gifts-2028", transactionDate: "2028-04-05", amountCentavos: 150_000 };
      const later = { ...history[0]!, id: "later", transactionDate: "2028-06-15", amountCentavos: 100_000 };

      const insights = detectUnusualSpendings([...history, gifts, nextYear(140_000), followingYear, later], yearly);

      expect(insights.map((insight) => insight.transactionId)).toEqual(["gifts-2026", "later"]);
      expect(insights[1]).toMatchObject({ usableHistoryCount: 6 });
    });
  });

  describe("expenses in certain months", () => {
    // Tuition paid in April, which the user said comes back in April and August.
    const tuition = { ...history[0]!, id: "tuition-apr", transactionDate: "2026-04-01", amountCentavos: 100_000 };
    const answers = new Map([["tuition-apr", "yearly" as const]]);
    const months = new Map([["tuition-apr", [4, 8]]]);
    const later = (id: string, transactionDate: string, amountCentavos = 140_000) => ({ ...history[0]!, id, transactionDate, amountCentavos });

    it("covers a payment in any chosen month of the following year without another alert", () => {
      expect(detectUnusualSpendings([...history, tuition, later("tuition-aug", "2026-08-03")], answers, months).map((insight) => insight.transactionId)).toEqual(["tuition-apr"]);
    });

    it("still flags a payment in a month the user did not choose", () => {
      expect(detectUnusualSpendings([...history, tuition, later("tuition-oct", "2026-10-03")], answers, months).map((insight) => insight.transactionId)).toEqual(["tuition-apr", "tuition-oct"]);
    });

    it("reports the chosen months on the insight", () => {
      expect(detectUnusualSpendings([...history, tuition], answers, months)[0]).toMatchObject({ recurrence: "yearly", recurrenceMonths: [4, 8] });
    });

    it("lists the answered payment and those it covers as recurring, with the chosen months", () => {
      const recurring = detectRecurringPayments([...history, tuition, later("tuition-aug", "2026-08-03"), later("tuition-apr-2027", "2027-04-05")], answers, months);
      expect(recurring.map((payment) => [payment.id, payment.months])).toEqual([["tuition-apr", [4, 8]], ["tuition-aug", [4, 8]], ["tuition-apr-2027", [4, 8]]]);
    });
  });
});

import type { Category, Subcategory } from "../../../../local-db/repositories/ledger/taxonomy";
import { recommendPlanAmount } from "../planAmountRecommendation";

const category = (id: string, rule: Partial<Category> = {}) => ({ id, label: id, fixed_amount_centavos: null, minimum_amount_centavos: null, ...rule }) as Category;
const subcategory = (id: string, categoryId: string | null, rule: Partial<Subcategory> = {}) => ({ id, category_id: categoryId, label: id, fixed_amount_centavos: null, minimum_amount_centavos: null, ...rule }) as Subcategory;

it("counts a category's spending once when some of its subcategories are planned separately", () => {
  const result = recommendPlanAmount({
    commitments: null,
    topLevelCategories: [category("food")],
    subcategories: [subcategory("groceries", "food"), subcategory("dining", "food")],
    includedCategoryIds: new Set(["food"]),
    includedIds: new Set(["groceries"]),
    expectedSpend: { subcategories: { groceries: 6_000, dining: 3_000 }, categories: { food: 10_000 } },
  });
  // Groceries ₱60 on its own, and food covers the remaining ₱40.
  expect(result).toEqual({ commitmentsCentavos: 0, spendingCentavos: 10_000, totalCentavos: 10_000 });
});

it("uses fixed amounts as set and never goes below a minimum or a one-time amount", () => {
  const result = recommendPlanAmount({
    commitments: { period: { start: "2026-10-01", end: "2026-10-31" }, debtReservations: [{ debtAccountId: "loan", dueDate: "2026-10-20", amountCentavos: 5_000 }], savingsReservations: [], obligations: [{ scheduledPaymentId: "bill", dueDate: "2026-10-22", amountCentavos: 2_000 }] },
    topLevelCategories: [],
    subcategories: [subcategory("rent", null, { fixed_amount_centavos: 30_000 }), subcategory("load", null, { minimum_amount_centavos: 1_000 }), subcategory("gym", null)],
    includedCategoryIds: new Set(),
    includedIds: new Set(["gym"]),
    expectedSpend: { subcategories: { rent: 40_000, load: 500 }, categories: {} },
    manualAllocations: [{ target: "subcategory", id: "gym", amountCentavos: 1_500 }],
  });
  expect(result).toEqual({ commitmentsCentavos: 7_000, spendingCentavos: 32_500, totalCentavos: 39_500 });
});

it("recommends each category's share of the plan's forecast, which caps what the plan allocates", () => {
  const result = recommendPlanAmount({
    commitments: null,
    topLevelCategories: [category("food", { slug: "food" }), category("fun", { slug: "recreation_culture" })],
    subcategories: [subcategory("groceries", "food"), subcategory("dining", "food"), subcategory("movies", "fun", { minimum_amount_centavos: 9_000 })],
    includedCategoryIds: new Set(),
    includedIds: new Set(["groceries", "dining"]),
    expectedSpend: { subcategories: { groceries: 6_000, dining: 2_000, movies: 1_000 }, categories: { food: 8_000, fun: 1_000 } },
    forecast: { food: 12_000, recreation_culture: 5_000 },
  });
  // Food's ₱120 forecast splits 3:1 by past spending; movies keeps its ₱90 minimum above its ₱50 forecast.
  expect(result).toEqual({ commitmentsCentavos: 0, spendingCentavos: 21_000, totalCentavos: 21_000 });
});

it("splits a forecast evenly between planned targets with no past spending", () => {
  const result = recommendPlanAmount({
    commitments: null,
    topLevelCategories: [category("food", { slug: "food" })],
    subcategories: [subcategory("groceries", "food"), subcategory("dining", "food")],
    includedCategoryIds: new Set(),
    includedIds: new Set(["groceries", "dining"]),
    expectedSpend: { subcategories: {}, categories: {} },
    forecast: { food: 10_000 },
  });
  expect(result.spendingCentavos).toBe(10_000);
});

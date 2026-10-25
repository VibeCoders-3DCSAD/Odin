import { detectUnusualSpendings } from "@odin/spending-insights";
import { buildSeedData, requiredSubcategorySlugs } from "../seed-history.js";
import { buildSeedRecurringSpending } from "../helpers/seed-recurring-spending.js";

const userId = "seed-user";
const subcategoryIds = new Map(requiredSubcategorySlugs.map((slug) => [slug, `subcategory-${slug}`]));

it("keeps seeded medicine purchases in the forecast after frequent-spending confirmations", () => {
  const today = "2026-10-21";
  const data = buildSeedData({ userId, today, seed: 42, subcategoryIds });
  const confirmations = buildSeedRecurringSpending(userId, data.transactions, subcategoryIds, today);
  expect(confirmations.length).toBeGreaterThan(0);
  const medicines = data.transactions.filter((row) => row.subcategory_id === subcategoryIds.get("health_medicines") && row.transaction_date >= "2025-10-21");
  const recurrences = new Map(confirmations.map((row) => [row.transaction_id, "frequent" as const]));
  expect(confirmations.every((row) => row.user_id === userId && row.recurrence === "frequent" && row.confirmed_recurring_at === `${today}T12:00:00+08:00`)).toBe(true);
  expect(confirmations.every((row) => medicines.some((transaction) => transaction.id === row.transaction_id && transaction.amount_centavos === row.amount_centavos))).toBe(true);
  const remainingOneOffs = detectUnusualSpendings(medicines.map((row) => ({
    id: row.id, transactionDate: row.transaction_date, amountCentavos: row.amount_centavos,
    subcategoryId: row.subcategory_id!, subcategoryLabel: "Medicines", accountName: null,
  })), recurrences).filter((insight) => !insight.confirmedRecurring);
  expect(remainingOneOffs).toEqual([]);
  expect(confirmations.some((row) => row.amount_centavos === 78666)).toBe(true);
  expect(confirmations.some((row) => row.amount_centavos === 90520)).toBe(true);
  expect(confirmations.some((row) => row.amount_centavos === 50997)).toBe(true);
});

it("does not confirm another user's purchases or other subcategories", () => {
  const today = "2026-10-21";
  const data = buildSeedData({ userId, today, seed: 42, subcategoryIds });
  expect(buildSeedRecurringSpending("another-user", data.transactions, subcategoryIds, today)).toEqual([]);
  expect(buildSeedRecurringSpending(userId, data.transactions, new Map(), today)).toEqual([]);
});

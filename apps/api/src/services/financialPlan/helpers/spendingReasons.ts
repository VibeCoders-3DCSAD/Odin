import type { FinancialPlanEvidence } from "../explanationService.js";
import { HFCE_CATEGORY_SLUGS, MONTHLY_SPENDING_REFERENCE, SEASON_CATEGORY_RULES, type HfceCategorySlug } from "../spendingReasonCatalog.js";

type Change = FinancialPlanEvidence["forecastChanges"][number];
type Preference = FinancialPlanEvidence["seasonalPreferences"][number];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SEASON_KEYS: Readonly<Record<string, string>> = {
  "Rainy Season": "rainy_season", "Back-to-School Season": "back_to_school",
  "Undas / All Souls' Day": "undas", "Christmas and Ber Months": "christmas_ber_months",
  "New Year": "new_year", Summer: "summer",
};

export function explanationPlanMonth(evidence: FinancialPlanEvidence): string | null {
  if (evidence.planMonth !== undefined) return /^\d{4}-(0[1-9]|1[0-2])$/.test(evidence.planMonth) ? evidence.planMonth : null;
  // Compatibility with already-issued explanation requests; avoid locale-dependent Date parsing.
  const match = /^(\w+) (\d{4})$/.exec(evidence.planPeriodLabel);
  const index = match ? MONTH_NAMES.indexOf(match[1]!) : -1;
  return match && index >= 0 ? `${match[2]}-${String(index + 1).padStart(2, "0")}` : null;
}

export function forecastCategorySlug(change: Change): HfceCategorySlug | null {
  const slug = change.categorySlug ?? change.evidenceId.replace(/^forecast:/, "");
  return HFCE_CATEGORY_SLUGS.find((category) => category === slug) ?? null;
}

export function categorySeasonalPreferences(evidence: FinancialPlanEvidence, change: Change, direction: "higher_expense" | "lower_expense"): Preference[] {
  const month = Number(explanationPlanMonth(evidence)?.slice(5, 7));
  const category = forecastCategorySlug(change);
  const reference = MONTHLY_SPENDING_REFERENCE.find((item) => item.month === month);
  if (!category || !reference || ![...reference.higher, ...reference.lower].includes(category)) return [];
  return evidence.seasonalPreferences.filter((preference) => {
    // A custom name cannot establish the category mapping of a built-in season.
    if (preference.evidenceId.includes(":custom_")) return false;
    const season = SEASON_KEYS[preference.season];
    const rule = season ? SEASON_CATEGORY_RULES[season] : undefined;
    return preference.preference === direction && rule?.months.includes(month)
      && reference.candidates.includes(season!) && rule.categories.includes(category);
  });
}

export function possibleSeasonalReasons(evidence: FinancialPlanEvidence, change: Change): string {
  if (change.baselineCentavos <= 0 || change.differenceCentavos === 0) return "";
  const direction = change.differenceCentavos > 0 ? "higher_expense" : "lower_expense";
  const seasons = [...new Set(categorySeasonalPreferences(evidence, change, direction).map(({ season }) => season))];
  return seasons.length > 0
    ? `Possible reasons include ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(seasons)}, based on your selected ${change.differenceCentavos > 0 ? "higher" : "lower"}-expense seasons.` : "";
}

export function confirmedCategoryPayments(evidence: FinancialPlanEvidence, change: Change): NonNullable<FinancialPlanEvidence["confirmedExpenses"]> {
  const month = explanationPlanMonth(evidence);
  const category = forecastCategorySlug(change);
  const seen = new Set<string>();
  return (evidence.confirmedExpenses ?? []).filter((expense) => {
    const key = `${expense.scheduledPaymentId}:${expense.dueDate}`;
    if (!month || !category || expense.categorySlug !== category || expense.dueDate.slice(0, 7) !== month || expense.amountCentavos <= 0 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

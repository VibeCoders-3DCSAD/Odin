import type { CategorySpending } from "../../../local-db/repositories/dashboardSummary";
import { dashboardColors } from "../dashboardAppearance";

export function groupSpendingCategories(categories: CategorySpending[]): CategorySpending[] {
  const sorted = [...categories].sort((a, b) => b.total_centavos - a.total_centavos);
  const topFive = sorted.slice(0, 5);
  const remaining = sorted.slice(5);
  if (remaining.length === 0) return topFive;

  return [...topFive, {
    category_id: "dashboard-others",
    category_label: "Others",
    icon_key: "tag",
    color_hex: dashboardColors.secondary,
    total_centavos: remaining.reduce((total, category) => total + category.total_centavos, 0),
  }];
}

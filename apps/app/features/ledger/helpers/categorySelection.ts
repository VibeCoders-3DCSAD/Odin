import type { CategorySelection } from "../../../components/CategorySelector";
import type { Category, Subcategory } from "../../../local-db/repositories/ledger/taxonomy";

export function emptyCategorySelection(): CategorySelection {
  return { tier: null, categoryId: null, subcategoryId: null };
}

export function getSelectedSubcategory(selection: CategorySelection, subcategories: Subcategory[]): Subcategory | null {
  return selection.subcategoryId
    ? subcategories.find((item) => item.id === selection.subcategoryId) ?? null
    : null;
}

export function getSelectedCategory(selection: CategorySelection, categories: Category[], subcategories: Subcategory[]): Category | null {
  if (selection.categoryId) {
    return categories.find((item) => item.id === selection.categoryId) ?? null;
  }
  const selectedSubcategory = getSelectedSubcategory(selection, subcategories);
  if (!selectedSubcategory?.category_id) return null;
  return categories.find((item) => item.id === selectedSubcategory.category_id) ?? null;
}

// A category-tier pick saves against that category's first subcategory.
export function resolveEffectiveSubcategoryId(selection: CategorySelection, subcategories: Subcategory[]): string {
  if (selection.subcategoryId) return selection.subcategoryId;
  if (selection.categoryId) {
    return subcategories.find((item) => item.category_id === selection.categoryId)?.id ?? "";
  }
  return "";
}

export function getCategoryFieldLabel(selection: CategorySelection, categories: Category[], subcategories: Subcategory[]): string {
  const subcategory = selection.tier === "subcategory" ? getSelectedSubcategory(selection, subcategories) : null;
  const category = getSelectedCategory(selection, categories, subcategories);
  if (subcategory && category) return `${category.label} · ${subcategory.label}`;
  if (selection.tier === "subcategory") return getSelectedSubcategory(selection, subcategories)?.label ?? "Select category";
  if (selection.tier === "category") return category?.label ?? "Select category";
  return "Select category";
}

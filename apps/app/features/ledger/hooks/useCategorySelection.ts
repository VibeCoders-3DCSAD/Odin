import { useEffect, useState } from "react";
import type { CategorySelection } from "../../../components/CategorySelector";
import type { Transaction } from "../../../local-db/repositories/ledger";
import type { Category, Subcategory } from "../../../local-db/repositories/taxonomy";
import type { TransactionType } from "../components/TransactionTypeSelector";
import {
  emptyCategorySelection,
  getCategoryFieldLabel,
  getSelectedCategory,
  getSelectedSubcategory,
  resolveEffectiveSubcategoryId,
} from "../helpers/categorySelection";

type Options = {
  txType: TransactionType;
  transaction?: Transaction;
  categories: Category[];
  subcategories: Subcategory[];
};

// Owns the category pick and the full-list picker page. A new transaction starts each type on its
// first subcategory; an edit keeps the saved one.
export function useCategorySelection({ txType, transaction, categories, subcategories }: Options) {
  const isEdit = !!transaction;
  const [categorySelection, setCategorySelection] = useState<CategorySelection>({
    tier: transaction?.subcategory_id ? "subcategory" : null,
    categoryId: null,
    subcategoryId: transaction?.subcategory_id ?? null,
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      setCategorySelection(emptyCategorySelection());
    }
  }, [txType, isEdit]);

  useEffect(() => {
    if (txType === "transfer") return;

    const currentSubcategory = getSelectedSubcategory(categorySelection, subcategories);
    const currentCategory = getSelectedCategory(categorySelection, categories, subcategories);
    if (currentCategory || currentSubcategory) {
      if (currentCategory?.id !== categorySelection.categoryId) {
        setCategorySelection((current) => ({
          ...current,
          categoryId: currentCategory?.id ?? current.categoryId,
        }));
      }
      return;
    }

    if (!isEdit && subcategories.length > 0) {
      const fallback = subcategories[0]!;
      const fallbackCategory = fallback.category_id ? categories.find((item) => item.id === fallback.category_id) ?? null : null;
      setCategorySelection({
        tier: "subcategory",
        categoryId: fallbackCategory?.id ?? null,
        subcategoryId: fallback.id,
      });
    }
  }, [
    subcategories,
    categories,
    txType,
    categorySelection.categoryId,
    categorySelection.subcategoryId,
    isEdit,
  ]);

  useEffect(() => {
    if (txType === "transfer") {
      setShowCategoryPicker(false);
    }
  }, [txType]);

  function selectCategory(nextSelection: CategorySelection) {
    setCategorySelection(nextSelection);
    setShowCategoryPicker(false);
  }

  const selectedCategory = getSelectedCategory(categorySelection, categories, subcategories);
  const selectedSubcategory = getSelectedSubcategory(categorySelection, subcategories);

  return {
    categorySelection,
    selectedCategory,
    selectedSubcategory,
    selectedVisual: categorySelection.tier === "subcategory" ? selectedSubcategory : selectedCategory,
    fieldLabel: getCategoryFieldLabel(categorySelection, categories, subcategories),
    effectiveSubcategoryId: resolveEffectiveSubcategoryId(categorySelection, subcategories),
    showCategoryPicker,
    setShowCategoryPicker,
    selectCategory,
    reset: () => setCategorySelection(emptyCategorySelection()),
  };
}

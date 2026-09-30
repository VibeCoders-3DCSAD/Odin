import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PlanCategorySelection } from "../PlanCategorySelection";
import type { Category, Subcategory } from "../../../local-db/repositories/taxonomy";

const food: Category = {
  id: "food",
  category_group_id: "household",
  slug: "food",
  label: "Food",
  short_label: null,
  description: "Food expenses",
  is_system: true,
  is_filipino_context: false,
  sort_order: 1,
  is_active: true,
};

const groceries: Subcategory = {
  id: "groceries",
  category_id: "food",
  slug: "groceries",
  kind: "expense",
  label: "Groceries",
  short_label: null,
  description: "Grocery expenses",
  is_system: true,
  is_filipino_context: false,
  is_protected: false,
  minimum_amount_centavos: null,
  always_in_budget: false,
  fixed_amount_centavos: null,
  sort_order: 1,
  is_active: true,
};

const dining: Subcategory = { ...groceries, id: "dining", slug: "dining", label: "Dining" };

describe("PlanCategorySelection", () => {
  it("groups subcategories under their top-level category and selects the full category", () => {
    const onToggleCategory = jest.fn();
    const view = render(<PlanCategorySelection
      topLevelCategories={[food]}
      subcategories={[groceries, dining]}
      includedIds={new Set(["groceries"])}
      recommendedIds={new Set()}
      onToggle={jest.fn()}
      onToggleCategory={onToggleCategory}
      onContinue={jest.fn()}
    />);

    expect(view.getByText("Food")).toBeTruthy();
    expect(view.getByText("Groceries")).toBeTruthy();
    expect(view.getByText("Dining")).toBeTruthy();

    fireEvent.press(view.getByLabelText("Include all Food in Financial Plan"));

    expect(onToggleCategory).toHaveBeenCalledWith(["groceries", "dining"]);
  });
});

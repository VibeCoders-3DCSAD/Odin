import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PlanCategorySelection } from "../PlanCategorySelection";
import type { Category, Subcategory } from "../../../local-db/repositories/taxonomy";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

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
  it("selects the broad category without selecting its subcategories", () => {
    const onToggleCategory = jest.fn();
    const view = render(<PlanCategorySelection
      topLevelCategories={[food]}
      subcategories={[groceries, dining]}
      includedIds={new Set(["groceries"])}
      recommendedIds={new Set()}
      onToggle={jest.fn()}
       onToggleCategory={onToggleCategory}
       onSaveRule={jest.fn().mockResolvedValue(undefined)}
       plannedAmount="1000.00"
       availableMoneyCentavos={100_000}
       planningAmountError={null}
       onPlannedAmountChange={jest.fn()}
       onContinue={jest.fn()}
    />);

    expect(view.getByText("Food")).toBeTruthy();
    expect(view.getByText("Groceries")).toBeTruthy();
    expect(view.getByText("Dining")).toBeTruthy();

    fireEvent.press(view.getByLabelText("Include Food in Financial Plan"));

    expect(onToggleCategory).toHaveBeenCalledWith("food");
  });

  it("saves a fixed Financial Plan rule on a subcategory", async () => {
    const onSaveRule = jest.fn().mockResolvedValue(undefined);
    const view = render(<PlanCategorySelection
      topLevelCategories={[food]}
      subcategories={[groceries]}
      includedIds={new Set()}
      recommendedIds={new Set()}
      onToggle={jest.fn()}
       onToggleCategory={jest.fn()}
       onSaveRule={onSaveRule}
       plannedAmount="1000.00"
       availableMoneyCentavos={100_000}
       planningAmountError={null}
       onPlannedAmountChange={jest.fn()}
       onContinue={jest.fn()}
    />);

    fireEvent.press(view.getByLabelText("Configure Financial Plan rule for Groceries"));
    fireEvent.press(view.getByLabelText("Fixed rule for Groceries"));
    fireEvent.changeText(view.getByLabelText("Fixed amount for Groceries in pesos"), "1250.50");
    fireEvent.press(view.getByLabelText("Save Financial Plan rule for Groceries"));

    await waitFor(() => expect(onSaveRule).toHaveBeenCalledWith(groceries, {
      rule: "FIXED",
      minimumAmountCentavos: null,
      fixedAmountCentavos: 125_050,
    }));
  });

  it("prevents a planning amount above available money", () => {
    const view = render(<PlanCategorySelection
      topLevelCategories={[food]}
      subcategories={[groceries]}
      includedIds={new Set(["groceries"])}
      recommendedIds={new Set()}
      onToggle={jest.fn()}
      onToggleCategory={jest.fn()}
      onSaveRule={jest.fn().mockResolvedValue(undefined)}
      plannedAmount="1000.01"
      availableMoneyCentavos={100_000}
      planningAmountError="Your planning amount cannot exceed available money."
      onPlannedAmountChange={jest.fn()}
      onContinue={jest.fn()}
    />);

    expect(view.getByText("Available money: PHP 1,000.00")).toBeTruthy();
    expect(view.getByText("Your planning amount cannot exceed available money.")).toBeTruthy();
    expect(view.getByLabelText("Create Financial Plan recommendation").props.accessibilityState?.disabled).toBe(true);
  });
});

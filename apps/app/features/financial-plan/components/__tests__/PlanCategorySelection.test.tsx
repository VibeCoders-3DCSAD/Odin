import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PlanCategorySelection } from "../PlanCategorySelection";
import type { Category, Subcategory } from "../../../../local-db/repositories/ledger/taxonomy";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaInsetsContext: jest.requireActual("react").createContext({ top: 0, right: 0, bottom: 0, left: 0 }),
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

const food: Category = {
  id: "food",
  slug: "food",
  label: "Food",
  short_label: null,
  description: "Food expenses",
  classification: "essential",
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

    fireEvent.press(view.getByLabelText("Show subcategories for Food"));
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

  it("requires a one-time amount for a selected category without history", () => {
    const onContinue = jest.fn();
    const view = render(<PlanCategorySelection
      topLevelCategories={[food]}
      subcategories={[groceries]}
      includedIds={new Set(["groceries"])}
      recommendedIds={new Set()}
      onToggle={jest.fn()}
      onToggleCategory={jest.fn()}
      onSaveRule={jest.fn().mockResolvedValue(undefined)}
      plannedAmount="1000.00"
      availableMoneyCentavos={100_000}
      planningAmountError={null}
      onPlannedAmountChange={jest.fn()}
      onContinue={onContinue}
    />);

    expect(view.getByText("You haven't used Groceries before. How much do you want to set aside?")).toBeTruthy();
    expect(view.getByLabelText("Continue to Plan").props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(view.getByLabelText("One-time plan amount for Groceries in pesos"), "750.50");
    fireEvent.press(view.getByLabelText("Continue to Plan"));

    expect(onContinue).toHaveBeenCalledWith([{ target: "subcategory", id: "groceries", amountCentavos: 75_050 }]);
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
    expect(view.getByLabelText("Continue to Plan").props.accessibilityState?.disabled).toBe(true);
  });

  it("restores a one-time category amount when returning from plan review", () => {
    const onContinue = jest.fn();
    const view = render(<PlanCategorySelection
      topLevelCategories={[food]} subcategories={[groceries]} includedIds={new Set(["groceries"])} recommendedIds={new Set()}
      onToggle={jest.fn()} onToggleCategory={jest.fn()} onSaveRule={jest.fn()}
      plannedAmount="1000.00" availableMoneyCentavos={100_000} planningAmountError={null} onPlannedAmountChange={jest.fn()}
      initialManualAllocations={[{ target: "subcategory", id: "groceries", amountCentavos: 75_050 }]} onContinue={onContinue}
    />);
    expect(view.getByLabelText("One-time plan amount for Groceries in pesos").props.value).toBe("750.50");
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    expect(onContinue).toHaveBeenCalledWith([{ target: "subcategory", id: "groceries", amountCentavos: 75_050 }]);
  });

  it("leaves commitment budgeting to the generated plan review", () => {
    const view = render(<PlanCategorySelection
      topLevelCategories={[food]}
      subcategories={[groceries]}
      includedIds={new Set(["groceries"])}
      recommendedIds={new Set()}
      onToggle={jest.fn()}
      onToggleCategory={jest.fn()}
      onSaveRule={jest.fn().mockResolvedValue(undefined)}
      plannedAmount="1000.00"
      availableMoneyCentavos={100_000}
      planningAmountError={null}
      onPlannedAmountChange={jest.fn()}
      onContinue={jest.fn()}
    />);

    expect(view.queryByLabelText("Skip Debt Repayments")).toBeNull();
    expect(view.queryByLabelText("Skip Savings Contributions")).toBeNull();
  });

  it("groups essentials apart from non-essentials and opens a category to toggle its subcategories", () => {
    const leisure: Category = { ...food, id: "leisure", slug: "leisure", label: "Leisure", classification: "non_essential" };
    const movies: Subcategory = { ...groceries, id: "movies", slug: "movies", category_id: "leisure", label: "Movies" };
    const onToggle = jest.fn();
    const view = render(<PlanCategorySelection
      topLevelCategories={[leisure, food]}
      subcategories={[groceries, movies]}
      includedIds={new Set()}
      recommendedIds={new Set()}
      onToggle={onToggle}
      onToggleCategory={jest.fn()}
      onSaveRule={jest.fn().mockResolvedValue(undefined)}
      plannedAmount="1000.00"
      availableMoneyCentavos={100_000}
      planningAmountError={null}
      onPlannedAmountChange={jest.fn()}
      onContinue={jest.fn()}
    />);

    const order = ["ESSENTIALS", "Food", "NON-ESSENTIALS", "Leisure"].map((text) => view.toJSON() && JSON.stringify(view.toJSON()).indexOf(`"${text}"`));
    expect(order).toEqual([...order].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(view.queryByText("Movies")).toBeNull();

    fireEvent.press(view.getByLabelText("Show subcategories for Leisure"));
    fireEvent.press(view.getByLabelText("Include Movies in Financial Plan"));
    expect(onToggle).toHaveBeenCalledWith("movies");

    fireEvent.press(view.getByLabelText("Hide subcategories for Leisure"));
    expect(view.queryByText("Movies")).toBeNull();
  });
});

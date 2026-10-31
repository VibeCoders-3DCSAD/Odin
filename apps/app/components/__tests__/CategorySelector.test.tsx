import React from "react";
import { StyleSheet, View } from "react-native";
import { fireEvent, render, within } from "@testing-library/react-native";
import { CategorySelectorTree } from "../CategorySelector";
import type { Category, Subcategory } from "../../local-db/repositories/ledger/taxonomy";

jest.mock("../../local-db/repositories/ledger/taxonomy", () => ({ listCategories: jest.fn(), listSubcategories: jest.fn() }));
jest.mock("../../features/taxonomy/taxonomyVisuals", () => ({
  DEFAULT_TAXONOMY_COLOR: "#0F766E",
  TaxonomyIcon: ({ iconKey }: { iconKey?: string }) => {
    const { Text } = require("react-native");
    return require("react").createElement(Text, { testID: "taxonomy-icon" }, iconKey ?? "tag");
  },
}));

const food: Category = {
  id: "food", slug: "food", label: "Food", short_label: null, description: "Food",
  classification: "essential", is_system: false, is_filipino_context: false,
  sort_order: 0, is_active: true, icon_key: "bowl-food", color_hex: "#E86A33",
};
const bakery: Subcategory = {
  id: "bakery", category_id: "food", slug: "food_bakery", kind: "expense", label: "Bakery",
  short_label: null, description: "Bread", is_system: false, is_filipino_context: false,
  is_protected: false, minimum_amount_centavos: null, always_in_budget: false,
  fixed_amount_centavos: null, sort_order: 0, is_active: true, icon_key: "bread", color_hex: "#D97706",
};

it("shows saved category and subcategory visuals while preserving selection and drill-down", () => {
  const onSelect = jest.fn();
  const view = render(<CategorySelectorTree categories={[food]} subcategories={[bakery]} selection={{ tier: null, categoryId: null, subcategoryId: null }} onSelect={onSelect} />);
  const categoryRow = view.getByLabelText("Select Food");
  expect(within(categoryRow).getByText("bowl-food")).toBeTruthy();
  expect(within(categoryRow).UNSAFE_getAllByType(View).map((node) => StyleSheet.flatten(node.props.style)?.backgroundColor)).toContain("#E86A33");
  fireEvent.press(categoryRow);
  expect(onSelect).toHaveBeenLastCalledWith({ tier: "category", categoryId: "food", subcategoryId: null });

  fireEvent.press(view.getByLabelText("Open Food"));
  const subcategoryRow = view.getByLabelText("Select Bakery");
  expect(within(subcategoryRow).getByText("bread")).toBeTruthy();
  expect(within(subcategoryRow).UNSAFE_getAllByType(View).map((node) => StyleSheet.flatten(node.props.style)?.backgroundColor)).toContain("#D97706");
  fireEvent.press(subcategoryRow);
  expect(onSelect).toHaveBeenLastCalledWith({ tier: "subcategory", categoryId: "food", subcategoryId: "bakery" });
});

it("uses saved visuals for income subcategories without a parent category", () => {
  const onSelect = jest.fn();
  const salary: Subcategory = { ...bakery, id: "salary", category_id: null, kind: "income", label: "Salary", icon_key: "bank", color_hex: "#15803D" };
  const view = render(<CategorySelectorTree categories={[]} subcategories={[salary]} selection={{ tier: null, categoryId: null, subcategoryId: null }} onSelect={onSelect} />);
  const row = view.getByLabelText("Select Salary");
  expect(within(row).getByText("bank")).toBeTruthy();
  expect(within(row).UNSAFE_getAllByType(View).map((node) => StyleSheet.flatten(node.props.style)?.backgroundColor)).toContain("#15803D");
  fireEvent.press(row);
  expect(onSelect).toHaveBeenCalledWith({ tier: "subcategory", categoryId: null, subcategoryId: "salary" });
});

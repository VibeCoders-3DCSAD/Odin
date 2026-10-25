import React from "react";
import { render } from "@testing-library/react-native";
import { PlanEssentialShortfall } from "../PlanEssentialShortfall";
import type { FinancialPlanAllocation } from "../types";

const allocations: FinancialPlanAllocation[] = [
  { categoryId: "leisure", label: "Leisure", allocationRule: "FLEXIBLE", allocatedAmountCentavos: 20_000, floorAmountCentavos: 0, subcategoryWeightBps: 5000 },
  { subcategoryId: "food", label: "Groceries", allocationRule: "MINIMUM", allocatedAmountCentavos: 40_000, floorAmountCentavos: 40_000 },
  { categoryId: "food", label: "Dining out", allocationRule: "FLEXIBLE", allocatedAmountCentavos: 10_000, floorAmountCentavos: 0 },
];
const restrictions = { allocations: [
  { id: "leisure", target: "category", priorityGroup: "NON_ESSENTIAL" },
  { id: "food", target: "subcategory", priorityGroup: "ESSENTIAL" },
  { id: "food", target: "category", priorityGroup: "NON_ESSENTIAL" },
] };

it("reports the total Essentials shortfall and updates it when budgets change", () => {
  const props = {
    allocations: [
      { ...allocations[1]!, allocatedAmountCentavos: 20_000, forecastAmountCentavos: 60_025 },
      { ...allocations[2]!, allocatedAmountCentavos: 0, forecastAmountCentavos: 10_000 },
      { ...allocations[0]!, allocatedAmountCentavos: 0, forecastAmountCentavos: 90_000 },
    ],
    restrictions: { allocations: [
      ...restrictions.allocations.filter((entry) => entry.target !== "category" || entry.id !== "food"),
      { id: "food", target: "category", priorityGroup: "ESSENTIAL" },
    ] },
    showSpendingProgress: false,
    readOnly: false,
    onFlexibleAmountChange: jest.fn(),
    onWeightChange: jest.fn(),
  };
  const view = render(<PlanEssentialShortfall {...props} />);
  expect(view.getByText("Essentials shortfall: ₱500.25")).toBeTruthy();
  expect(view.getByRole("alert")).toBeTruthy();

  // Extra money in one Essential cannot cover a different underfunded Essential.
  view.rerender(<PlanEssentialShortfall {...props} allocations={props.allocations.map((allocation, index) => index === 0 ? { ...allocation, allocatedAmountCentavos: 100_000 } : allocation)} />);
  expect(view.getByText("Essentials shortfall: ₱100.00")).toBeTruthy();

  view.rerender(<PlanEssentialShortfall {...props} allocations={props.allocations.map((allocation, index) => index === 2 ? allocation : { ...allocation, allocatedAmountCentavos: 100_000 })} />);
  expect(view.queryByRole("alert")).toBeNull();
});

it("uses fixed budgets and minimum floors when reporting saved Essentials shortfalls", () => {
  const view = render(<PlanEssentialShortfall allocations={[
    { ...allocations[1]!, allocationRule: "FIXED", allocatedAmountCentavos: 40_000, forecastAmountCentavos: 90_000 },
    { ...allocations[2]!, allocationRule: "MINIMUM", floorAmountCentavos: 20_000, allocatedAmountCentavos: 15_000, forecastAmountCentavos: 10_000 },
  ]} restrictions={{ allocations: [
    { id: "food", target: "subcategory", priorityGroup: "ESSENTIAL" },
    { id: "food", target: "category", priorityGroup: "ESSENTIAL" },
  ] }} />);
  expect(view.getByText("Essentials shortfall: ₱50.00")).toBeTruthy();
});

it("reports an uncovered minimum even when its allocation and forecast are zero", () => {
  const view = render(<PlanEssentialShortfall allocations={[{ ...allocations[1]!, allocatedAmountCentavos: 0, forecastAmountCentavos: 0 }]} restrictions={restrictions} />);
  expect(view.getByText("Essentials shortfall: ₱400.00")).toBeTruthy();
});

it("hides the card when only fractional centavos are missing", () => {
  const view = render(<PlanEssentialShortfall allocations={[{ ...allocations[1]!, allocatedAmountCentavos: 40_000, forecastAmountCentavos: 40_000.0000002 }]} restrictions={restrictions} />);
  expect(view.queryByRole("alert")).toBeNull();
});

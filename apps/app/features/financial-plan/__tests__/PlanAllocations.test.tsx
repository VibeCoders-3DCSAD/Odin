import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PlanAllocations } from "../PlanAllocations";
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

it("separates essentials first, totals each group, and edits the original allocation indices", () => {
  const onFlexibleAmountChange = jest.fn();
  const onWeightChange = jest.fn();
  const view = render(<PlanAllocations allocations={allocations} restrictions={restrictions} showSpendingProgress={false} readOnly={false} onFlexibleAmountChange={onFlexibleAmountChange} onWeightChange={onWeightChange} />);
  expect(view.getAllByText("₱400.00")).toHaveLength(2);
  expect(view.getByText("₱300.00")).toBeTruthy();
  expect(view.queryByText("Other allocations")).toBeNull();
  const output = JSON.stringify(view.toJSON());
  expect(output.indexOf("Essentials")).toBeLessThan(output.indexOf("Groceries"));
  expect(output.indexOf("Groceries")).toBeLessThan(output.indexOf("Non-essentials"));
  expect(output.indexOf("Non-essentials")).toBeLessThan(output.indexOf("Leisure"));
  expect(output.indexOf("Non-essentials")).toBeLessThan(output.indexOf("Dining out"));
  fireEvent.changeText(view.getByLabelText("Leisure flexible amount in pesos"), "250.00");
  fireEvent.changeText(view.getByLabelText("Dining out flexible amount in pesos"), "120.00");
  fireEvent.changeText(view.getByLabelText("Leisure subcategory weight percent"), "60");
  expect(onFlexibleAmountChange.mock.calls).toEqual([[0, "250.00"], [2, "120.00"]]);
  expect(onWeightChange).toHaveBeenCalledWith(0, "60");
});

it("preserves saved spending progress for legacy allocations without priority data", () => {
  const view = render(<PlanAllocations allocations={[{ ...allocations[0]!, spentAmountCentavos: 25_000 }]} showSpendingProgress readOnly onFlexibleAmountChange={jest.fn()} onWeightChange={jest.fn()} />);
  expect(view.getByText("Other allocations")).toBeTruthy();
  expect(view.getByText("Leisure")).toBeTruthy();
  expect(view.getByLabelText("Leisure is ₱50.00 over budget")).toBeTruthy();
  expect(view.queryByLabelText("Leisure flexible amount in pesos")).toBeNull();
});

it("hides zero forecast and zero allocation rows while keeping edits tied to their original indices", () => {
  const covered: FinancialPlanAllocation = { subcategoryId: "rent", label: "Rent", allocationRule: "FLEXIBLE", allocatedAmountCentavos: 0, floorAmountCentavos: 0, forecastAmountCentavos: 0 };
  const onFlexibleAmountChange = jest.fn();
  const view = render(<PlanAllocations allocations={[covered, allocations[0]!]} restrictions={{ allocations: [{ id: "rent", target: "subcategory", priorityGroup: "ESSENTIAL" }, ...restrictions.allocations] }} showSpendingProgress={false} readOnly={false} onFlexibleAmountChange={onFlexibleAmountChange} onWeightChange={jest.fn()} />);
  expect(view.queryByText("Rent")).toBeNull();
  expect(view.queryByText("Essentials")).toBeNull();
  expect(view.getByText("Leisure")).toBeTruthy();
  fireEvent.changeText(view.getByLabelText("Leisure flexible amount in pesos"), "250.00");
  expect(onFlexibleAmountChange).toHaveBeenCalledWith(1, "250.00");
});

it("keeps zero allocations visible when they have a forecast, recorded spending, or an unknown forecast", () => {
  const zero: FinancialPlanAllocation = { allocationRule: "FLEXIBLE", allocatedAmountCentavos: 0, floorAmountCentavos: 0, forecastAmountCentavos: 0 };
  const view = render(<PlanAllocations allocations={[
    { ...zero, subcategoryId: "food", label: "Food", forecastAmountCentavos: 10_000 },
    { ...zero, subcategoryId: "rent", label: "Rent", spentAmountCentavos: 5_000 },
    { ...zero, subcategoryId: "legacy", label: "Legacy", forecastAmountCentavos: undefined },
  ]} showSpendingProgress readOnly onFlexibleAmountChange={jest.fn()} onWeightChange={jest.fn()} />);
  expect(view.getByText("Food")).toBeTruthy();
  expect(view.getByLabelText("Rent is ₱50.00 over budget")).toBeTruthy();
  expect(view.getByText("Legacy")).toBeTruthy();
});

it("hides the section when there are no visible allocations", () => {
  const view = render(<PlanAllocations allocations={[{ subcategoryId: "rent", label: "Rent", allocationRule: "FLEXIBLE", allocatedAmountCentavos: 0, floorAmountCentavos: 0, forecastAmountCentavos: 0 }]} showSpendingProgress={false} readOnly={false} onFlexibleAmountChange={jest.fn()} onWeightChange={jest.fn()} />);
  expect(view.queryByText("Category Allocations")).toBeNull();
});

it("displays two decimal places without changing the calculated allocation", () => {
  const allocation = { ...allocations[0]!, allocatedAmountCentavos: 205.48558236891725 * 100 };
  const onFlexibleAmountChange = jest.fn();
  const view = render(<PlanAllocations allocations={[allocation]} showSpendingProgress={false} readOnly={false} onFlexibleAmountChange={onFlexibleAmountChange} onWeightChange={jest.fn()} />);
  expect(view.getByLabelText("Leisure flexible amount in pesos").props.value).toBe("205.49");
  expect(allocation.allocatedAmountCentavos).toBe(205.48558236891725 * 100);
  expect(onFlexibleAmountChange).not.toHaveBeenCalled();
});

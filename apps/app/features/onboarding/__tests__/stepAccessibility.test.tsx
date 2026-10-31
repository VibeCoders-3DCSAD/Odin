import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { CardSelectStep } from "../steps/CardSelectStep";
import { CardMultiSelectStep } from "../steps/CardMultiSelectStep";
import { AmountListStep } from "../steps/AmountListStep";
import { InputStep } from "../steps/InputStep";
import { ReviewStep } from "../steps/ReviewStep";
import type { StepConfig } from "../types";

jest.mock("phosphor-react-native", () => ({ Check: "Icon", PencilSimple: "Icon" }));

const optionStep: StepConfig = {
  key: "runway",
  title: "Savings Runway",
  kind: "card_select",
  questionKey: "runway",
  options: [
    { key: "none", label: "No savings", description: "Less than a month" },
    { key: "two", label: "Two months" },
  ],
};

it.each(["card", "dropdown"] as const)("names %s options and exposes the selected one", (variant) => {
  const onSelect = jest.fn();
  const view = render(<CardSelectStep step={optionStep} selected="two" onSelect={onSelect} variant={variant} />);

  expect(view.getByRole("radio", { name: "No savings" }).props.accessibilityState).toEqual({ selected: false });
  expect(view.getByRole("radio", { name: "Two months" }).props.accessibilityState).toEqual({ selected: true });
  expect(view.queryByText("Less than a month") !== null).toBe(variant === "card");

  fireEvent.press(view.getByRole("radio", { name: "No savings" }));
  expect(onSelect).toHaveBeenCalledWith("none");
});

it("names multi-select options and exposes their checked state", () => {
  const view = render(<CardMultiSelectStep step={optionStep} selected={["none"]} onToggle={jest.fn()} />);

  expect(view.getByRole("checkbox", { name: "No savings" }).props.accessibilityState).toEqual({ checked: true });
  expect(view.getByRole("checkbox", { name: "Two months" }).props.accessibilityState).toEqual({ checked: false });
});

it("names each review row's Edit button after the row", () => {
  const onEdit = jest.fn();
  const view = render(<ReviewStep answers={{ display_name: "Juan" }} onEdit={onEdit} incomeText="50000" />);

  fireEvent.press(view.getByRole("button", { name: "Edit Name" }));
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(view.getByRole("button", { name: "Edit Monthly Income After Deductions" })).toBeTruthy();
});

it("names text and amount inputs", () => {
  const inputStep: StepConfig = { key: "display_name", title: "Your name", kind: "input", questionKey: "display_name", inputLabel: "Display name" };
  expect(render(<InputStep step={inputStep} value="" onChangeText={jest.fn()} />).getByLabelText("Display name")).toBeTruthy();

  const amountStep: StepConfig = { key: "amounts", title: "Amounts", kind: "amount_list", questionKey: "amounts", amountOptions: [{ key: "sss", label: "SSS" }] };
  expect(render(<AmountListStep step={amountStep} selected={["sss"]} values={{}} onChange={jest.fn()} />).getByLabelText("SSS Monthly Amount")).toBeTruthy();
});

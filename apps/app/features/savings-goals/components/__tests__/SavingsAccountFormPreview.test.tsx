import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import SavingsAccountFormPreview from "../SavingsAccountFormPreview";

jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");

describe("Savings account form preview", () => {
  it("keeps each type's draft and shows only applicable inputs", () => {
    const view = render(<SavingsAccountFormPreview onCancel={jest.fn()} />);
    fireEvent.changeText(view.getByLabelText("Savings name"), "Maya Savings");
    fireEvent.changeText(view.getByLabelText("Base annual interest rate"), "3");
    expect(view.queryByLabelText("Total annual rate while boosted")).toBeNull();
    fireEvent.press(view.getByLabelText("Higher rate currently active?"));
    fireEvent.changeText(view.getByLabelText("Total annual rate while boosted"), "15");
    fireEvent.press(view.getByLabelText("Time Deposit"));
    expect(view.getByLabelText("Principal amount")).toBeTruthy();
    expect(view.getByLabelText("Start date")).toBeTruthy();
    expect(view.getByLabelText("Maturity date")).toBeTruthy();
    expect(view.queryByText("Contributions")).toBeNull();
    expect(view.queryByLabelText("Set a savings goal")).toBeNull();
    expect(view.queryByLabelText("Higher rate currently active?")).toBeNull();
    fireEvent.press(view.getByLabelText("Traditional Savings"));
    fireEvent.changeText(view.getByLabelText("Annual interest rate"), "0.25");
    expect(view.queryByLabelText("Maturity date")).toBeNull();
    fireEvent.press(view.getByLabelText("HYSA"));
    expect(view.getByLabelText("Savings name").props.value).toBe("Maya Savings");
    expect(view.getByLabelText("Base annual interest rate").props.value).toBe("3");
    expect(view.getByLabelText("Total annual rate while boosted").props.value).toBe("15");
    fireEvent.press(view.getByLabelText("Traditional Savings"));
    expect(view.getByLabelText("Annual interest rate").props.value).toBe("0.25");
  });

  it("validates details, then reviews without saving and returns to the draft", () => {
    const view = render(<SavingsAccountFormPreview onCancel={jest.fn()} />);
    fireEvent.press(view.getByLabelText("Review details"));
    expect(view.getByText("Enter a savings name.")).toBeTruthy();
    fireEvent.changeText(view.getByLabelText("Savings name"), "Maya Savings");
    fireEvent.changeText(view.getByLabelText("Current balance"), "150000");
    fireEvent.changeText(view.getByLabelText("Base annual interest rate"), "3");
    fireEvent.press(view.getByLabelText("Review details"));
    expect(view.getByText("Review savings")).toBeTruthy();
    expect(view.getByText("PHP 150,000.00")).toBeTruthy();
    expect(view.getByText("Manual contributions")).toBeTruthy();
    expect(view.queryByLabelText("Save savings")).toBeNull();
    fireEvent.press(view.getByLabelText("Back to edit"));
    expect(view.getByLabelText("Savings name").props.value).toBe("Maya Savings");
    expect(view.getByLabelText("Current balance").props.value).toBe("150000");
  });
});

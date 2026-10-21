import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import type { SavingsInterestReference } from "@odin/savings-interest";
import SavingsInterestFields from "../SavingsInterestFields";

function Form() {
  const [reference, setReference] = useState<SavingsInterestReference | null>(null);
  const [rate, setRate] = useState("4");
  return <SavingsInterestFields rate={rate} onRateChange={setRate} reference={reference} onReferenceChange={setReference} />;
}
it("keeps all fixed interest controls inside Advanced Options with agreed defaults", () => {
  const view = render(<Form />);
  expect(view.queryByLabelText("Interest rate")).toBeNull();
  fireEvent.press(view.getByLabelText("Advanced interest options"));
  expect(view.getByLabelText("Interest rate").props.value).toBe("4");
  expect(view.queryByLabelText("Automatic interest projections")).toBeNull();
  expect(view.queryByText("Accrued interest when stopping")).toBeNull();
  expect(view.getByLabelText("Withholding tax (%)").props.value).toBe("20");
  expect(view.getByLabelText("Credit frequency: Monthly").props.accessibilityState.checked).toBe(true);
  expect(view.queryByText("Rate structure")).toBeNull();
  expect(view.queryByText("Tiered Interest")).toBeNull();
  fireEvent.press(view.getByLabelText("Calculation basis: Average Daily Balance (ADB)"));
  expect(view.getByLabelText("ADB averaging period: Calendar month").props.accessibilityState.checked).toBe(true);
  fireEvent.press(view.getByLabelText("Credit frequency: Custom"));
  fireEvent.changeText(view.getByLabelText("Credit interval (days)"), "14");
  fireEvent.press(view.getByLabelText("Posting timing: Day of month"));
  fireEvent.changeText(view.getByLabelText("Posting day (1–31)"), "15");
  fireEvent.press(view.getByLabelText("Withholding tax"));
  expect(view.queryByLabelText("Withholding tax (%)")).toBeNull();
  fireEvent.press(view.getByLabelText("Interest behavior: None"));
  expect(view.queryByLabelText("Interest start date")).toBeNull();
  expect(view.queryByLabelText("Interest rate")).toBeNull();
  expect(view.queryByLabelText("Automatic interest projections")).toBeNull();
  expect(view.getByText(/This account earns 0% interest/)).toBeTruthy();
});
it("shows starting balance for a backdated start and supports dated rate changes", () => {
  const view = render(<Form />);
  fireEvent.press(view.getByLabelText("Advanced interest options"));
  fireEvent.changeText(view.getByLabelText("Interest start date"), "2020-01-01");
  fireEvent.changeText(view.getByLabelText("Interest starting balance (₱)"), "10000");
  fireEvent.press(view.getByLabelText("Add rate change"));
  expect(view.getByLabelText("Rate 1 effective date")).toBeTruthy();
  fireEvent.changeText(view.getByLabelText("Rate 1 (% p.a.)"), "5");
  fireEvent.press(view.getByLabelText("Advanced interest options"));
  expect(view.queryByLabelText("Interest start date")).toBeNull();
  fireEvent.press(view.getByLabelText("Advanced interest options"));
  expect(view.getByLabelText("Interest starting balance (₱)").props.value).toBe("10000");
  expect(view.getByLabelText("Rate 1 (% p.a.)").props.value).toBe("5");
});

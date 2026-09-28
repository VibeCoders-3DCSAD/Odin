import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { DebtForecastTable } from "../DebtForecastTable";

describe("DebtForecastTable", () => {
  it("shows the payoff date on the debt-free milestone", () => {
    const view = render(
      <DebtForecastTable
        points={[{ id: "payoff", date: "2027-03-16", balanceCentavos: 0, isForecast: true }]}
        milestoneDate="2027-03-16"
      />,
    );

    expect(view.getByText("Debt-free milestone · 2027-03-16")).toBeTruthy();
  });

  it("reveals forecast balances in eight-row chunks", () => {
    const points = [
      { id: "actual", date: "2026-01-01", balanceCentavos: 10_000, isForecast: false },
      ...Array.from({ length: 12 }, (_, index) => ({ id: `forecast-${index}`, date: `2026-02-${String(index + 1).padStart(2, "0")}`, balanceCentavos: 9_000 - index * 100, isForecast: true })),
    ];
    const view = render(<DebtForecastTable points={points} />);

    expect(view.getByRole("button", { name: "Show 8 more forecast balances" })).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Show 8 more forecast balances" }));
    expect(view.getByText("2026-02-11")).toBeTruthy();
    expect(view.getByRole("button", { name: "Show 1 more forecast balance" })).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Show 1 more forecast balance" }));
    expect(view.getByText("2026-02-12")).toBeTruthy();
    expect(view.queryByRole("button", { name: /more forecast balance/ })).toBeNull();
  });
});

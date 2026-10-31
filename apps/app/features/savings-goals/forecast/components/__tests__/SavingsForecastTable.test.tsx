import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SavingsForecastTable } from "../SavingsForecastTable";

describe("SavingsForecastTable", () => {
  it("reveals forecast balances in eight-row chunks", () => {
    const points = [
      { date: "2026-01-01", balanceCentavos: 10_000, event: "current_balance" as const, isForecast: false },
      ...Array.from({ length: 12 }, (_, index) => ({ date: `2026-02-${String(index + 1).padStart(2, "0")}`, balanceCentavos: 9_000 - index * 100, event: "scheduled_contribution" as const, isForecast: true })),
    ];
    const view = render(<SavingsForecastTable points={points} />);

    fireEvent.press(view.getByRole("button", { name: "Show 8 more forecast balances" }));
    expect(view.getByText("Planned contribution · 2026-02-11")).toBeTruthy();
    expect(view.getByRole("button", { name: "Show 1 more forecast balance" })).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Show 1 more forecast balance" }));
    expect(view.getByText("Planned contribution · 2026-02-12")).toBeTruthy();
    expect(view.queryByRole("button", { name: /more forecast balance/ })).toBeNull();
  });
});

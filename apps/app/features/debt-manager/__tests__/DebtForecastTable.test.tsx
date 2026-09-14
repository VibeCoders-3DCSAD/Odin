import React from "react";
import { render } from "@testing-library/react-native";
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
});

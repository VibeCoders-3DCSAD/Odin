import React from "react";
import { View } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import GlobalDebtTrend from "../GlobalDebtTrend";
import { DebtForecastChart } from "../DebtForecastChart";

jest.mock("../DebtForecastChart", () => ({ DebtForecastChart: jest.fn(() => null) }));

describe("GlobalDebtTrend monthly balances", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-21T04:00:00Z"));
    jest.clearAllMocks();
  });

  afterEach(() => jest.useRealTimers());

  it("uses closing monthly balances in the chart and table, preserving the actual/forecast boundary and payoff", () => {
    const view = render(<GlobalDebtTrend points={[
      { date: "2026-09-05", debtCentavos: 30_000 },
      { date: "2026-09-30", debtCentavos: 28_000 },
      { date: "2026-10-05", debtCentavos: 27_000 },
      { date: "2026-10-21", debtCentavos: 25_000 },
      { date: "2026-10-25", debtCentavos: 24_000 },
      { date: "2026-10-30", debtCentavos: 23_000 },
      { date: "2026-11-05", debtCentavos: 20_000 },
      { date: "2026-11-20", debtCentavos: 15_000 },
      { date: "2026-12-05", debtCentavos: 10_000 },
      { date: "2026-12-20", debtCentavos: 0 },
    ]} />);
    fireEvent.press(view.getByRole("button", { name: "Show all debt history" }));
    const chartContainer = view.UNSAFE_getAllByType(View).find((node) => node.props.onLayout)!;
    fireEvent(chartContainer, "layout", { nativeEvent: { layout: { width: 320 } } });

    expect(jest.mocked(DebtForecastChart).mock.calls.at(-1)?.[0].points.map((point) => point.date)).toEqual([
      "2026-09-30", "2026-10-21", "2026-10-30", "2026-11-20", "2026-12-20",
    ]);
    expect(view.getByText("Nov 2026")).toBeTruthy();
    expect(view.getByText("₱150.00")).toBeTruthy();
    expect(view.getByText("Debt-free milestone · Dec 2026")).toBeTruthy();
    expect(view.queryByText("2026-11-05")).toBeNull();
    expect(view.queryByRole("button", { name: /more forecast balance/ })).toBeNull();
  });
});

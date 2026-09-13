import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { DebtForecastChart } from "../DebtForecastChart";

describe("DebtForecastChart", () => {
  it("does not create invalid SVG keys when a balance is not finite", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    render(<DebtForecastChart
      points={[
        { id: "actual", date: "2026-09-13", balanceCentavos: Number.NaN, isForecast: false },
        { id: "forecast", date: "2026-10-13", balanceCentavos: 10_000, isForecast: true },
      ]}
      status="on_schedule"
      today="2026-09-13"
      width={320}
      colorMode="blue"
    />);

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("shows an exact balance while a chart node is held", () => {
    const { getByLabelText, queryByLabelText } = render(<DebtForecastChart
      points={[{ id: "actual", date: "2026-09-13", balanceCentavos: 12_345, isForecast: false }]}
      status="on_schedule"
      today="2026-09-13"
      width={320}
      colorMode="blue"
    />);

    const node = getByLabelText("2026-09-13, actual balance PHP 123.45");
    fireEvent(node, "longPress");

    expect(getByLabelText("Selected actual balance on 2026-09-13: PHP 123.45")).toBeTruthy();

    fireEvent(node, "pressOut");

    expect(queryByLabelText("Selected actual balance on 2026-09-13: PHP 123.45")).toBeNull();
  });

});

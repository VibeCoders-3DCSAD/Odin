import React from "react";
import { render } from "@testing-library/react-native";
import { ForecastPanel } from "../ForecastPanel";

describe("ForecastPanel", () => {
  it("shows the server's reason when no forecast is available", () => {
    const message = "You haven't recorded expenses in the last 6 months. Add recent expenses to get a spending forecast.";
    const view = render(<ForecastPanel forecast={null} onRefresh={() => {}} emptyMessage={message} />);

    expect(view.getByText(message)).toBeTruthy();
    expect(view.queryByText("Record posted transactions to unlock a spending forecast.")).toBeNull();
  });
});

import { fireEvent, render } from "@testing-library/react-native";
import { getQuarterlyForecastContent } from "../../dashboard/dashboardSnapshotContent";
import { monthlyForecast, QuarterlyForecastCharts } from "../QuarterlyForecastCharts";
import { addScheduledPayments } from "../scheduledForecast";
import type { QuarterlyForecastPayload } from "../types";

const food = (amountCentavos: number) => ({ totalCentavos: amountCentavos, categories: [{ category: "food", amountCentavos }] });

const forecast: QuarterlyForecastPayload = {
  quarters: [{ quarter: "2026Q4", ...food(600_000) }, { quarter: "2027Q1", ...food(300_000) }],
  months: [{ month: "2026-11", ...food(100_000) }, { month: "2026-12", ...food(300_000) }, { month: "2027-01", ...food(100_000) }],
  modelVersion: "hfce-sarima-v4-category-quarterly",
  generatedAt: "2026-10-25T00:00:00.000Z",
  quality: "PERSONALIZED",
  baselineMethod: "same_period_last_year",
  seasonalUncertainty: false,
};

describe("monthly spending forecast", () => {
  it("shows months only once a full year of history sets each month's baseline", () => {
    expect(monthlyForecast(forecast)).toBe(forecast.months);
    expect(monthlyForecast({ ...forecast, baselineMethod: "median_monthly" })).toBeNull();
    expect(monthlyForecast({ ...forecast, months: undefined })).toBeNull();
  });

  it("charts each forecast month instead of quarter tabs", () => {
    const view = render(<QuarterlyForecastCharts forecast={forecast} history={[{ quarter: "2026Q3", ...food(250_000) }]} />);

    expect(view.queryByRole("tab")).toBeNull();
    expect(view.getByText("November 2026")).toBeTruthy();
    expect(view.getAllByText("PHP 1,000")).toHaveLength(2);
    expect(view.getByText("All forecast categories, per month")).toBeTruthy();
    expect(view.getByLabelText("Total projected spending for 3 months")).toBeTruthy();
  });

  it("keeps quarter tabs while the baseline is not seasonal", () => {
    const view = render(<QuarterlyForecastCharts forecast={{ ...forecast, baselineMethod: "median_monthly", seasonalUncertainty: true }} />);

    fireEvent.press(view.getByLabelText("Show Q1 2027 forecast"));
    expect(view.getByText("January 1 to March 31, 2027")).toBeTruthy();
  });

  it("adds scheduled payments to the months they fall due", () => {
    const withBills = addScheduledPayments(forecast, [{ frequency: "monthly", dueDayOfMonth: 15, dueSecondDayOfMonth: null, dueDayOfWeek: null, dueMonth: null, startsOn: "2026-12-01", endsOn: null, amountCentavos: 50_000 }]);

    expect(withBills.months?.map((month) => month.totalCentavos)).toEqual([100_000, 350_000, 150_000]);
  });

  it("restores saved months and drops malformed ones", () => {
    const saved = getQuarterlyForecastContent({ id: "s-1", user_id: "user-1", source: "forecast_quarterly", payload_json: JSON.stringify({ ...forecast, months: [...forecast.months!, { month: "2027-13", ...food(1) }] }), stale: false } as Parameters<typeof getQuarterlyForecastContent>[0]);

    expect(saved?.months).toEqual(forecast.months);
    expect(saved?.baselineMethod).toBe("same_period_last_year");
  });
});

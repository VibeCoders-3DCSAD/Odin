import { fireEvent, render } from "@testing-library/react-native";
import { Path, Rect } from "react-native-svg";
import { getQuarterlyForecastContent } from "../../dashboard/dashboardSnapshotContent";
import { monthlyForecast, QuarterlyForecastCharts } from "../QuarterlyForecastCharts";
import { addScheduledPayments } from "../scheduledForecast";
import type { QuarterlyForecastPayload } from "../types";

const food = (amountCentavos: number) => ({ totalCentavos: amountCentavos, categories: [{ category: "food", amountCentavos }] });

const forecast: QuarterlyForecastPayload = {
  quarters: [{ quarter: "2026Q4", ...food(500_000) }, { quarter: "2027Q1", ...food(300_000) }],
  months: ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02"].map((month) => ({ month, ...food(month === "2026-12" ? 300_000 : 100_000) })),
  modelVersion: "hfce-sarima-v4-category-quarterly",
  generatedAt: "2026-10-25T00:00:00.000Z",
  quality: "PERSONALIZED",
  baselineMethod: "same_period_last_year",
  seasonalUncertainty: false,
};

const NOW = new Date("2026-10-25T00:00:00Z");
const monthHistory = [{ month: "2026-08", ...food(90_000) }, { month: "2026-09", ...food(110_000) }, { month: "2026-10", ...food(40_000) }];

// The chart points' coordinates, from a path's "M x y L x y ..." commands.
const pathPoints = (d: string) => d.split(/[ML]/).map((point) => point.trim()).filter(Boolean);

describe("monthly spending forecast", () => {
  it("shows this month and the next three once six months of history let each month walk forward by HFCE", () => {
    const shown = ["2026-10", "2026-11", "2026-12", "2027-01"];

    expect(monthlyForecast(forecast, NOW)?.map((month) => month.month)).toEqual(shown);
    expect(monthlyForecast({ ...forecast, baselineMethod: "median_monthly" }, NOW)?.map((month) => month.month)).toEqual(shown);
    expect(monthlyForecast({ ...forecast, baselineMethod: "recency_weighted_provisional" }, NOW)).toBeNull();
    expect(monthlyForecast({ ...forecast, months: undefined }, NOW)).toBeNull();
  });

  it("charts each forecast month after this one instead of quarter tabs", () => {
    const view = render(<QuarterlyForecastCharts forecast={forecast} history={[{ quarter: "2026Q3", ...food(250_000) }]} now={NOW} />);

    expect(view.queryByRole("tab")).toBeNull();
    expect(view.getByText("November 2026")).toBeTruthy();
    expect(view.getAllByText("PHP 1,000")).toHaveLength(2);
    expect(view.getByText("All forecast categories, per month")).toBeTruthy();
    expect(view.getByLabelText("Total projected spending for 3 months")).toBeTruthy();
  });

  it("charts three months of actual spending, this month so far, then three dashed forecast months", () => {
    const view = render(<QuarterlyForecastCharts forecast={forecast} monthHistory={monthHistory} now={NOW} />);

    expect(view.getByText("3 months of actual spending and 3 forecast months")).toBeTruthy();
    // Charts draw once their width is known.
    fireEvent(view.getByLabelText("Actual spending for 3 months and projected spending for 3 months"), "layout", { nativeEvent: { layout: { width: 320 } } });
    const [actual, projected] = view.UNSAFE_getAllByType(Path).filter((path) => path.props.fill === "none");
    expect([actual!.props.strokeDasharray, projected!.props.strokeDasharray]).toEqual([undefined, "5 4"]);
    // Solid through August, September, and October so far; dashed from October through January.
    const solid = pathPoints(actual!.props.d);
    const dashed = pathPoints(projected!.props.d);
    expect(solid).toHaveLength(3);
    expect(dashed).toHaveLength(4);
    expect(dashed[0]).toBe(solid[2]);

    fireEvent.press(view.UNSAFE_getAllByType(Rect).filter((rect) => rect.props.fill === "transparent")[2]!);
    expect(view.getByText("October 2026 · actual spending so far")).toBeTruthy();
  });

  it("compares this month's forecast with its spending so far inside the total and category cards", () => {
    const view = render(<QuarterlyForecastCharts forecast={forecast} monthHistory={monthHistory} now={NOW} />);

    expect(view.getAllByText("Forecast vs Actual")).toHaveLength(2);
    expect(view.getAllByText("October 2026 so far, against this month's forecast")).toHaveLength(2);
    expect(view.getByLabelText("Total: PHP 400 spent of PHP 1,000 forecast, 40% of forecast")).toBeTruthy();
    expect(view.getByLabelText("Food and groceries: PHP 400 spent of PHP 1,000 forecast, 40% of forecast")).toBeTruthy();

    const over = render(<QuarterlyForecastCharts forecast={forecast} monthHistory={[{ month: "2026-10", ...food(150_000) }]} now={NOW} />);
    expect(over.getAllByText("PHP 500 over")).toHaveLength(2);
  });

  it("compares the chosen category when the category changes", () => {
    const mixed = (food: number, transport: number) => ({ totalCentavos: food + transport, categories: [{ category: "food", amountCentavos: food }, { category: "transport", amountCentavos: transport }] });
    const view = render(<QuarterlyForecastCharts
      forecast={{ ...forecast, months: [{ month: "2026-10", ...mixed(70_000, 30_000) }, { month: "2026-11", ...mixed(70_000, 30_000) }] }}
      monthHistory={[{ month: "2026-10", ...mixed(25_000, 45_000) }]}
      now={NOW}
    />);

    expect(view.getByLabelText("Food and groceries: PHP 250 spent of PHP 700 forecast, 36% of forecast")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Choose spending category: Food and groceries"));
    fireEvent.press(view.getByLabelText("Transportation"));
    expect(view.getByLabelText("Transportation: PHP 450 spent of PHP 300 forecast, PHP 150 over")).toBeTruthy();
    expect(view.getByLabelText("Total: PHP 700 spent of PHP 1,000 forecast, 70% of forecast")).toBeTruthy();
  });

  it("keeps quarter tabs while the baseline is provisional", () => {
    const view = render(<QuarterlyForecastCharts forecast={{ ...forecast, baselineMethod: "recency_weighted_provisional", seasonalUncertainty: true }} />);

    fireEvent.press(view.getByLabelText("Show Q1 2027 forecast"));
    expect(view.getByText("January 1 to March 31, 2027")).toBeTruthy();
  });

  it("adds scheduled payments to the months they fall due", () => {
    const withBills = addScheduledPayments(forecast, [{ frequency: "monthly", dueDayOfMonth: 15, dueSecondDayOfMonth: null, dueDayOfWeek: null, dueMonth: null, startsOn: "2026-12-01", endsOn: null, amountCentavos: 50_000 }]);

    expect(withBills.months?.map((month) => month.totalCentavos)).toEqual([100_000, 100_000, 350_000, 150_000, 150_000]);
  });

  it("restores saved months and drops malformed ones", () => {
    const saved = getQuarterlyForecastContent({ id: "s-1", user_id: "user-1", source: "forecast_quarterly", payload_json: JSON.stringify({ ...forecast, months: [...forecast.months!, { month: "2027-13", ...food(1) }] }), stale: false } as Parameters<typeof getQuarterlyForecastContent>[0]);

    expect(saved?.months).toEqual(forecast.months);
    expect(saved?.baselineMethod).toBe("same_period_last_year");
  });
});

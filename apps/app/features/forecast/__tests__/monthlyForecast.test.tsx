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
const monthHistory = [{ month: "2026-07", ...food(80_000) }, { month: "2026-08", ...food(90_000) }, { month: "2026-09", ...food(110_000) }, { month: "2026-10", ...food(40_000) }];

// The chart points' coordinates, from a path's "M x y L x y ..." commands.
const pathPoints = (d: string) => d.split(/[ML]/).map((point) => point.trim()).filter(Boolean);

// Opens the time range dropdown and picks a range.
const chooseRange = (view: ReturnType<typeof render>, range: string) => {
  fireEvent.press(view.getByLabelText(/^Choose time range: /));
  fireEvent.press(view.getByRole("radio", { name: range }));
};

describe("monthly spending forecast", () => {
  it("offers this month and the next five once six months of history let each month walk forward by HFCE", () => {
    const shown = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02"];

    expect(monthlyForecast(forecast, NOW)?.map((month) => month.month)).toEqual(shown);
    expect(monthlyForecast({ ...forecast, baselineMethod: "median_monthly" }, NOW)?.map((month) => month.month)).toEqual(shown);
    expect(monthlyForecast({ ...forecast, baselineMethod: "recency_weighted_provisional" }, NOW)).toBeNull();
    expect(monthlyForecast({ ...forecast, months: undefined }, NOW)).toBeNull();
    // 1 AM on November 1 in Manila: November is this month, though it is still October in UTC.
    expect(monthlyForecast(forecast, new Date("2026-10-31T17:00:00Z"))?.map((month) => month.month)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("charts this month and the next two instead of quarter tabs", () => {
    const view = render(<QuarterlyForecastCharts forecast={forecast} history={[{ quarter: "2026Q3", ...food(250_000) }]} now={NOW} />);

    expect(view.queryByRole("tab")).toBeNull();
    expect(view.getByText("October 2026")).toBeTruthy();
    expect(view.getByText("PHP 1,000")).toBeTruthy();
    expect(view.getByText("All forecast categories, per month")).toBeTruthy();
    expect(view.getByLabelText("Total projected spending for 3 months")).toBeTruthy();
  });

  it("charts three completed months of actual spending, then three dashed forecast months from this one", () => {
    const view = render(<QuarterlyForecastCharts forecast={forecast} monthHistory={monthHistory} now={NOW} />);

    expect(view.getByText("3 months of actual spending and 3 forecast months")).toBeTruthy();
    // Charts draw once their width is known.
    fireEvent(view.getByLabelText("Actual spending for 3 months and projected spending for 3 months"), "layout", { nativeEvent: { layout: { width: 320 } } });
    const [actual, projected] = view.UNSAFE_getAllByType(Path).filter((path) => path.props.fill === "none");
    expect([actual!.props.strokeDasharray, projected!.props.strokeDasharray]).toEqual([undefined, "5 4"]);
    // Solid through July, August, and September; dashed from September through December.
    const solid = pathPoints(actual!.props.d);
    const dashed = pathPoints(projected!.props.d);
    expect(solid).toHaveLength(3);
    expect(dashed).toHaveLength(4);
    expect(dashed[0]).toBe(solid[2]);

    fireEvent.press(view.UNSAFE_getAllByType(Rect).filter((rect) => rect.props.fill === "transparent")[2]!);
    expect(view.getByText("September 2026 · actual spending")).toBeTruthy();
  });

  it("switches the chart between past, mixed, and forward ranges", () => {
    const history = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((month) => ({ month, ...food(80_000) }));
    const months = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"].map((month) => ({ month, ...food(100_000) }));
    const view = render(<QuarterlyForecastCharts forecast={{ ...forecast, months }} monthHistory={history} now={NOW} />);

    chooseRange(view, "Past 6");
    expect(view.getByText("6 months of actual spending and 0 forecast months")).toBeTruthy();
    expect(view.getByLabelText("Actual spending for 6 months and projected spending for 0 months")).toBeTruthy();
    expect(view.getByText("September 2026 · actual spending")).toBeTruthy();

    chooseRange(view, "Next 6");
    expect(view.getByLabelText("Total projected spending for 6 months")).toBeTruthy();
    expect(view.getByText("October 2026")).toBeTruthy();
    expect(view.getByText("Forecast vs Actual")).toBeTruthy();
  });

  it("keeps the range when switching to quarters, which reach four quarters ahead", () => {
    const quarters = ["2026Q4", "2027Q1", "2027Q2", "2027Q3"].map((quarter) => ({ quarter, ...food(300_000) }));
    const history = ["2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2", "2026Q3"].map((quarter) => ({ quarter, ...food(250_000) }));
    const view = render(<QuarterlyForecastCharts forecast={{ ...forecast, quarters }} history={history} now={NOW} />);

    fireEvent.press(view.getByLabelText("Show spending: Quarterly"));
    expect(view.getByText("3 quarters of actual spending and 3 forecast quarters")).toBeTruthy();
    chooseRange(view, "Past 2 · Next 4");
    expect(view.getByText("2 quarters of actual spending and 4 forecast quarters")).toBeTruthy();
    expect(view.getAllByRole("tab")).toHaveLength(4);
    expect(view.getByText("October 1 to December 31, 2026")).toBeTruthy();
  });

  it("says a range has no spending yet instead of an empty chart", () => {
    const view = render(<QuarterlyForecastCharts forecast={forecast} now={NOW} />);

    chooseRange(view, "Past 6");
    expect(view.getByText("No recorded spending in this range yet.")).toBeTruthy();
    chooseRange(view, "Next 6");
    expect(view.getByLabelText("Total projected spending for 5 months")).toBeTruthy();
  });

  it("compares this month's forecast with its spending so far inside the spending card", () => {
    const view = render(<QuarterlyForecastCharts forecast={forecast} monthHistory={monthHistory} now={NOW} />);

    expect(view.getByText("Forecast vs Actual")).toBeTruthy();
    expect(view.getByText("October 2026 so far, against this month's forecast")).toBeTruthy();
    expect(view.getByLabelText("Total: PHP 400 spent of PHP 1,000 forecast, 40% of forecast")).toBeTruthy();

    const over = render(<QuarterlyForecastCharts forecast={forecast} monthHistory={[{ month: "2026-10", ...food(150_000) }]} now={NOW} />);
    expect(over.getByText("PHP 500 over")).toBeTruthy();
  });

  it("compares this quarter's forecast with its months so far once the view is quarterly", () => {
    const november = new Date("2026-11-20T00:00:00Z");
    const history = [{ month: "2026-09", ...food(500_000) }, { month: "2026-10", ...food(120_000) }, { month: "2026-11", ...food(30_000) }];
    const view = render(<QuarterlyForecastCharts forecast={forecast} monthHistory={history} now={november} />);

    fireEvent.press(view.getByLabelText("Show spending: Quarterly"));
    expect(view.getByText("Q4 2026 so far, against this quarter's forecast")).toBeTruthy();
    // October and November count toward Q4; September belongs to Q3.
    expect(view.getByLabelText("Total: PHP 1,500 spent of PHP 5,000 forecast, 30% of forecast")).toBeTruthy();
  });

  it("compares the total, then the chosen category when the dropdown changes", () => {
    const mixed = (food: number, transport: number) => ({ totalCentavos: food + transport, categories: [{ category: "food", amountCentavos: food }, { category: "transport", amountCentavos: transport }] });
    const view = render(<QuarterlyForecastCharts
      forecast={{ ...forecast, months: [{ month: "2026-10", ...mixed(70_000, 30_000) }, { month: "2026-11", ...mixed(70_000, 30_000) }] }}
      monthHistory={[{ month: "2026-10", ...mixed(25_000, 45_000) }]}
      now={NOW}
    />);

    expect(view.getByLabelText("Total: PHP 700 spent of PHP 1,000 forecast, 70% of forecast")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Choose spending category: Total"));
    fireEvent.press(view.getByLabelText("Food and groceries"));
    expect(view.getByLabelText("Food and groceries: PHP 250 spent of PHP 700 forecast, 36% of forecast")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Choose spending category: Food and groceries"));
    fireEvent.press(view.getByLabelText("Transportation"));
    expect(view.getByLabelText("Transportation: PHP 450 spent of PHP 300 forecast, PHP 150 over")).toBeTruthy();
    expect(view.queryByLabelText(/^Total: /)).toBeNull();
  });

  it("keeps quarter tabs while the baseline is provisional", () => {
    const view = render(<QuarterlyForecastCharts forecast={{ ...forecast, baselineMethod: "recency_weighted_provisional", seasonalUncertainty: true }} />);

    expect(view.queryByLabelText("Show spending: Monthly")).toBeNull();
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

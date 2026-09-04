import { getBudgetContent, getForecastContent, getSnapshotCentavos, getSnapshotCount, getSnapshotText } from "../dashboardSnapshotContent";

const snapshot = (payload: unknown) => ({
  id: "snapshot-1",
  user_id: "user-1",
  source: "budget_health" as const,
  payload_json: JSON.stringify(payload),
  updated_at: new Date().toISOString(),
  stale: false,
});

test("normalizes dashboard snapshot content without accepting malformed values", () => {
  expect(getSnapshotText(snapshot({ summary: "On track" }))).toBe("On track");
  expect(getSnapshotCount(snapshot({ count: 2 }))).toBe(2);
  expect(getSnapshotCentavos(snapshot({ saved_centavos: 125000 }), ["saved_centavos"])).toBe(125000);
  expect(getBudgetContent(snapshot({ status: "warning", items: [{ label: "Food", spent: 1200, budget: 2000 }, { label: 1 }] }))).toEqual({
    status: "warning",
    items: [{ label: "Food", spent: 1200, budget: 2000 }],
  });
  expect(getBudgetContent(snapshot({ status: "unknown", items: [{ label: "Food", spent: Number.NaN, budget: Infinity }] }))).toEqual({ status: "unknown", items: [] });
  expect(getBudgetContent(snapshot({ status: "warning", period_start: "2000-01-01", period_end: "2000-01-31", items: [{ label: "Food", spent: 1200, budget: 2000 }] }))).toEqual({ status: "unknown", items: [] });
  expect(getForecastContent(snapshot({ summary: "You are on track", projected_balance_centavos: 125000, period: "month end", income_centavos: 800000, expense_centavos: 600000, categories: [{ label: "Food", amount_centavos: 200000 }], expected_events: [{ label: "Rent", date: "Aug 31" }], freshness: "Updated today", confidence: "High confidence", insights: ["Keep groceries below PHP 2,000", 1] }))).toEqual({
    text: "You are on track",
    projectedBalanceCentavos: 125000,
    period: "month end",
    insights: ["Keep groceries below PHP 2,000"],
    incomeCentavos: 800000,
    expenseCentavos: 600000,
    categories: [{ label: "Food", amountCentavos: 200000 }],
    events: [{ label: "Rent", date: "Aug 31" }],
    freshness: "Updated today",
    confidence: "High confidence",
  });
});

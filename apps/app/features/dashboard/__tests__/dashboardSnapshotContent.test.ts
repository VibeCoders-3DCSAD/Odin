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
  expect(getForecastContent(snapshot({ forecasts: [{ date: "2026-10", amountCentavos: 125000, category: "Essentials" }], forecastHorizon: "MONTHLY", forecastLevel: "CATEGORY_GROUP", confidenceInterval: { lower80Centavos: 100000, upper80Centavos: 150000, lower95Centavos: 90000, upper95Centavos: 160000 }, modelVersion: "v2.4.0", status: "FALLBACK" }))).toEqual({
    forecasts: [{ date: "2026-10", amountCentavos: 125000, category: "Essentials" }],
    forecastHorizon: "MONTHLY",
    forecastLevel: "CATEGORY_GROUP",
    confidenceInterval: { lower80Centavos: 100000, upper80Centavos: 150000, lower95Centavos: 90000, upper95Centavos: 160000 },
    modelVersion: "v2.4.0",
    status: "FALLBACK",
  });
  expect(getForecastContent(snapshot({ forecasts: [], forecastHorizon: "YEARLY", forecastLevel: "TOTAL", confidenceInterval: { lower80Centavos: 100000, upper80Centavos: 150000, lower95Centavos: 90000, upper95Centavos: 160000 }, modelVersion: "v2.4.0", status: "SUCCESS" }))).toEqual(expect.objectContaining({ forecastHorizon: "YEARLY" }));
});

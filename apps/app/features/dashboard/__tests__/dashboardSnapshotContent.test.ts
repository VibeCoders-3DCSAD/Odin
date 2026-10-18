import { getForecastContent, getQuarterlyForecastContent, getSnapshotCentavos, getSnapshotCount, getSnapshotText } from "../dashboardSnapshotContent";

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
  expect(getForecastContent(snapshot({ forecasts: [{ category: "food", month: "2026-10", quarter: "2026Q4", amountCentavos: 125000, userBaselineCentavos: 100000, hfceMultiplier: 1.25, hfceForecastAmountMillionPhp: 1200, explanation: "Personalized food forecast." }], modelVersion: "hfce-sarima-v4-category-quarterly", status: "SUCCESS" }))).toEqual({
    forecasts: [{ category: "food", month: "2026-10", quarter: "2026Q4", amountCentavos: 125000, userBaselineCentavos: 100000, hfceMultiplier: 1.25, hfceForecastAmountMillionPhp: 1200, explanation: "Personalized food forecast." }],
    modelVersion: "hfce-sarima-v4-category-quarterly",
    status: "SUCCESS",
  });
  expect(getForecastContent(snapshot({ forecasts: [], modelVersion: "hfce-sarima-v4-category-quarterly", status: "SUCCESS" }))).toEqual(expect.objectContaining({ forecasts: [] }));
});

test("keeps well-formed quarterly forecast rows and drops malformed ones", () => {
  expect(getQuarterlyForecastContent(snapshot({
    quarters: [
      { quarter: "2026Q4", totalCentavos: 300000, categories: [{ category: "food", amountCentavos: 300000 }, { category: "health" }] },
      { quarter: "2026-Q1", totalCentavos: 1, categories: [] },
    ],
    modelVersion: "hfce-sarima-v4-category-quarterly",
    generatedAt: "2026-10-18T00:00:00.000Z",
  }))).toEqual({
    quarters: [{ quarter: "2026Q4", totalCentavos: 300000, categories: [{ category: "food", amountCentavos: 300000 }] }],
    modelVersion: "hfce-sarima-v4-category-quarterly",
    generatedAt: "2026-10-18T00:00:00.000Z",
  });
  expect(getQuarterlyForecastContent(snapshot({ quarters: [], modelVersion: "v", generatedAt: "2026-10-18T00:00:00.000Z" }))).toBeNull();
  expect(getQuarterlyForecastContent(snapshot({ quarters: [{ quarter: "2026Q4", totalCentavos: 1, categories: [] }], modelVersion: "v", generatedAt: "2026-10-18T00:00:00.000Z", interpretation: ["Saved note.", 3, ""] }))?.interpretation).toEqual(["Saved note."]);
});

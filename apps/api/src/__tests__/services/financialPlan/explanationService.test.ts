import { explainFinancialPlan, fallbackFinancialPlanExplanations, isUserFacingFinancialPlanExplanation, zeroAllocationExplanations, type FinancialPlanEvidence } from "../../../services/financialPlan/explanationService.js";
import { seasonalPreferencesFromAnswers } from "../../../services/financialPlan/recommendationService.js";

const evidence: FinancialPlanEvidence = {
  planPeriodLabel: "December 2026",
  surplusCentavos: 5_000,
  debtSurplusCentavos: 2_500,
  savingsSurplusCentavos: 2_500,
  seasonalPreferences: [{ evidenceId: "saving_seasons:christmas_ber_months", season: "Christmas and Ber Months", seasonWindow: "September to December", preference: "saving" }],
  forecastChanges: [{ evidenceId: "forecast:food", categoryName: "Food", baselineCentavos: 10_000, forecastCentavos: 11_240, allocationCentavos: 12_000, allocationForecastDifferenceCentavos: 760, differenceCentavos: 1_240, percentageChange: 12.4, forecastRationale: "The model projects higher food spending from the supplied trend.", possibleSeasonalContext: null }],
};

describe("Financial Plan explanation service", () => {
  const originalApiKey = process.env.GROQ_API_KEY;

  afterEach(() => { process.env.GROQ_API_KEY = originalApiKey; });

  it("uses only model insights supported by evidence IDs", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ insights: [
      { type: "forecast_change", title: "Food allocation", message: "Food is higher in December.", evidence_ids: ["forecast:food"] },
      { type: "surplus", title: "Unsupported", message: "Move it to investments.", evidence_ids: ["invented"] },
    ] }) } }] }) });

    await expect(explainFinancialPlan(evidence, fetcher)).resolves.toEqual(["Food is higher in December."]);
  });

  it("removes duplicate messages and puts a shortfall first", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const shortfallEvidence = { ...evidence, shortfall: { plannedAmountCentavos: 50_000, requiredFundsCentavos: 65_000, shortfallCentavos: 15_000 }, seasonalPreferences: [
      { evidenceId: "saving_seasons:christmas_ber_months", season: "Christmas and Ber Months", seasonWindow: "September to December", preference: "saving" },
      { evidenceId: "high_expense_seasons:christmas_ber_months", season: "Christmas and Ber Months", seasonWindow: "September to December", preference: "higher_expense" },
    ] };
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ insights: [
      { type: "seasonal_preference", title: "Season", message: "Christmas has competing preferences.", evidence_ids: ["saving_seasons:christmas_ber_months"] },
      { type: "seasonal_preference", title: "Season again", message: "Christmas has competing preferences.", evidence_ids: ["high_expense_seasons:christmas_ber_months"] },
      { type: "shortfall", title: "Shortfall", message: "Requirements exceed planned funds by PHP 150.00.", evidence_ids: ["plan-shortfall"] },
    ] }) } }] }) });

    await expect(explainFinancialPlan(shortfallEvidence, fetcher)).resolves.toEqual([
      "Requirements exceed planned funds by PHP 150.00.",
      "Christmas has competing preferences.",
    ]);
  });

  it("falls back to deterministic evidence-backed explanations", () => {
    expect(fallbackFinancialPlanExplanations(evidence)).toEqual(expect.arrayContaining([
      expect.stringContaining("remains available"),
      expect.stringContaining("Christmas and Ber Months"),
      expect.stringContaining("The plan allocates"),
      expect.stringContaining("Forecast context"),
    ]));
  });

  it("combines competing seasonal preferences into one trade-off insight", () => {
    const explanations = fallbackFinancialPlanExplanations({ ...evidence, seasonalPreferences: [
      { evidenceId: "saving_seasons:christmas_ber_months", season: "Christmas and Ber Months", seasonWindow: "September to December", preference: "saving" },
      { evidenceId: "high_expense_seasons:christmas_ber_months", season: "Christmas and Ber Months", seasonWindow: "September to December", preference: "higher_expense" },
    ] });

    expect(explanations.filter((explanation) => explanation.includes("Christmas and Ber Months"))).toEqual([
      expect.stringContaining("both saving and higher expenses"),
    ]);
  });

  it("explains a shortfall when Groq is unavailable", () => {
    expect(fallbackFinancialPlanExplanations({ ...evidence, shortfall: { plannedAmountCentavos: 50_000, requiredFundsCentavos: 65_000, shortfallCentavos: 15_000 } })[0]).toBe(
      "Required commitments total PHP 650.00 against PHP 500.00 planned, leaving a PHP 150.00 shortfall.",
    );
  });

  it("explains zero allocations using only the required floor and forecast", () => {
    expect(zeroAllocationExplanations([
      { categoryName: "Dining Out", allocationCentavos: 0, requiredFloorCentavos: 0, forecastCentavos: 0 },
      { categoryName: "Shopping", allocationCentavos: 0, requiredFloorCentavos: 0, forecastCentavos: 15_000 },
    ])).toEqual([
      "Dining Out received PHP 0.00 because it has no required peso allocation or forecasted spending.",
    ]);
  });

  it("excludes Summer preferences from an October plan", () => {
    expect(seasonalPreferencesFromAnswers({
      saving_seasons: ["summer", "christmas_ber_months"],
      high_expense_seasons: ["summer", "undas"],
    }, "2026-10-01")).toEqual([
      expect.objectContaining({ season: "Christmas and Ber Months", preference: "saving" }),
      expect.objectContaining({ season: "Undas / All Souls' Day", preference: "higher_expense" }),
    ]);
  });

  it("excludes HFCE terminology from user-facing insights", () => {
    expect(isUserFacingFinancialPlanExplanation("HFCE forecast increased.")).toBe(false);
    expect(isUserFacingFinancialPlanExplanation("Household final consumption expenditure increased.")).toBe(false);
    expect(isUserFacingFinancialPlanExplanation("Food is forecast above baseline.")).toBe(true);
  });
});

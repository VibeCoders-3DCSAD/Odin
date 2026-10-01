import { explainFinancialPlan, fallbackFinancialPlanExplanations, type FinancialPlanEvidence } from "../../../services/financialPlan/explanationService.js";

const evidence: FinancialPlanEvidence = {
  planPeriodLabel: "December 2026",
  surplusCentavos: 5_000,
  debtSurplusCentavos: 2_500,
  savingsSurplusCentavos: 2_500,
  seasonalPreferences: [{ evidenceId: "saving_seasons:christmas_ber_months", season: "Christmas and Ber Months", preference: "saving" }],
  forecastChanges: [{ evidenceId: "forecast:food", categoryName: "Food", baselineCentavos: 10_000, forecastCentavos: 11_240, differenceCentavos: 1_240 }],
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

  it("falls back to deterministic evidence-backed explanations", () => {
    expect(fallbackFinancialPlanExplanations(evidence)).toEqual(expect.arrayContaining([
      expect.stringContaining("Forecast surplus"),
      expect.stringContaining("Christmas and Ber Months"),
      expect.stringContaining("Food is forecast"),
    ]));
  });
});

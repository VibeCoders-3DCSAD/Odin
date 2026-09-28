import { MlAlertProvider } from "../../../services/alerts/mlAlertProvider.js";

describe("MlAlertProvider", () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.ML_SERVICE_URL;
  const originalSecret = process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET;

  beforeEach(() => {
    process.env.ML_SERVICE_URL = "https://ml.example.test";
    process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET = "test-secret";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ML_SERVICE_URL = originalUrl;
    process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET = originalSecret;
  });

  it("maps ML anomaly decisions to report findings without exposing raw scores", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ decisions: [{ transaction_id: "transaction-1", state: "ANOMALOUS", severity: 1.2, usual_spending: 100, reason: "Outside the usual range." }] }),
    }) as never;

    const findings = await new MlAlertProvider().evaluate({
      user_id: "user-1",
      report_date: "2026-09-23",
      transactions: [{ id: "transaction-1", amount_centavos: 12_500, transaction_date: "2026-09-23", transaction_type: "expense", category_id: "category-1", subcategory_id: "subcategory-1", merchant_name: "Store" }],
    });

    expect(findings).toEqual([expect.objectContaining({
      candidate_key: "transaction:transaction-1",
      finding: "unusual_transaction",
      source_references: { transaction_id: "transaction-1", subcategory_id: "subcategory-1", usual_spending_percent: "25.00", usual_spending_centavos: "10000" },
    })]);
    expect((global.fetch as jest.Mock).mock.calls[0]?.[0]).toBe("https://ml.example.test/api/v1/anomaly/detect");
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0]?.[1].body)).toMatchObject({
      transactions: [expect.objectContaining({ category: "subcategory_subcategory_1" })],
    });
    expect(findings[0]).toMatchObject({
      explanation: "This spending is 25.00% higher than your usual spending.",
      source_references: { usual_spending_percent: "25.00", usual_spending_centavos: "10000" },
    });
  });

  it("uses the parent category only when a legacy transaction has no subcategory", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ decisions: [] }) }) as never;

    await new MlAlertProvider().evaluate({
      user_id: "user-1",
      report_date: "2026-09-23",
      transactions: [{ id: "transaction-1", amount_centavos: 12_500, transaction_date: "2026-09-23", transaction_type: "expense", category_id: "category-1", subcategory_id: null, merchant_name: "Store" }],
    });

    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0]?.[1].body)).toMatchObject({
      transactions: [expect.objectContaining({ category: "category_category_1" })],
    });
  });

  it("records model unavailability instead of throwing when the gateway fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as never;

    const findings = await new MlAlertProvider().evaluate({
      user_id: "user-1",
      report_date: "2026-09-23",
      transactions: [{ id: "transaction-1", amount_centavos: 12_500, transaction_date: "2026-09-23", transaction_type: "expense", category_id: "category-1", subcategory_id: "subcategory-1", merchant_name: "Store" }],
    });

    expect(findings).toEqual([expect.objectContaining({ finding: "model_unavailable" })]);
  });

  it("defaults anomalous findings without an ML severity to warning", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ decisions: [{ transaction_id: "transaction-1", state: "ANOMALOUS", reason: "Outside the usual range." }] }),
    }) as never;

    const findings = await new MlAlertProvider().evaluate({
      user_id: "user-1",
      report_date: "2026-09-23",
      transactions: [{ id: "transaction-1", amount_centavos: 12_500, transaction_date: "2026-09-23", transaction_type: "expense", category_id: "category-1", subcategory_id: "subcategory-1", merchant_name: "Store" }],
    });

    expect(findings).toEqual([expect.objectContaining({ finding: "unusual_transaction", severity: "warning" })]);
  });
});

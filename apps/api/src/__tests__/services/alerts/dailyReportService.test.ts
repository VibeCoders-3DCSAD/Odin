import { buildBudgetOverspendingFindings, normalizeModelFindings } from "../../../services/alerts/dailyReportService";

describe("daily report findings", () => {
  it("maps qualifying model scores to configured severity", () => {
    const findings = normalizeModelFindings([{ candidate_key: "tx:1", finding: "unusual_transaction", severity: null, explanation: null, source_references: {}, anomaly_score: 0.9 }]);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("creates budget findings only at the configured overage threshold", () => {
    const budgets = [{ id: "budget-1", period_start: "2026-09-01", period_end: "2026-09-30", budget_allocations: [{ id: "allocation-1", allocated_amount_centavos: 1_000, category_id: "category-1", subcategory_id: null }] }];
    const findings = buildBudgetOverspendingFindings(budgets, [{ id: "tx-1", amount_centavos: 1_250, transaction_date: "2026-09-10", category_id: "category-1", subcategory_id: null, merchant_name: null }], "2026-09-10");
    expect(findings).toMatchObject([{ finding: "budget_overspending", severity: "critical" }]);
  });
});

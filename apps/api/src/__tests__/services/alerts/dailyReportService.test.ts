import { buildFinancialPlanOverspendingFindings, buildReportAlerts, normalizeModelFindings, runDailyFinancialReport } from "../../../services/alerts/dailyReportService";

describe("daily report findings", () => {
  it("maps qualifying model scores to configured severity", () => {
    const findings = normalizeModelFindings([{ candidate_key: "tx:1", finding: "unusual_transaction", severity: null, explanation: null, source_references: {}, anomaly_score: 0.9 }]);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("creates findings from accepted Financial Plan allocations", () => {
    const plans = [{ id: "plan-1", period_start: "2026-09-01", period_end: "2026-09-30", financial_plan_allocations: [{ id: "allocation-1", allocated_amount_centavos: 1_000, category_id: "category-1", subcategory_id: null }] }];
    const findings = buildFinancialPlanOverspendingFindings(plans, [{ id: "tx-1", amount_centavos: 1_250, transaction_date: "2026-09-10", category_id: "category-1", subcategory_id: null, merchant_name: null }], "2026-09-10");
    expect(findings).toMatchObject([{ finding: "budget_overspending", severity: "critical" }]);
    expect(findings[0]?.source_references).toMatchObject({ financial_plan_id: "plan-1", financial_plan_allocation_id: "allocation-1" });
  });

  it("keeps insufficient history in the financial report without creating an alert", () => {
    const findings = [{ candidate_key: "history:2026-09-23", finding: "insufficient_history" as const, severity: null, explanation: "More transaction history is needed.", source_references: {}, anomaly_score: null }];

    expect(buildReportAlerts(findings)).toEqual([]);
  });

  it("gets transaction categories from the subcategory relation", async () => {
    let transactionSelect = "";
    let transactionStartDate = "";
    const transactions = {
      select: (columns: string) => { transactionSelect = columns; return transactions; },
      eq: () => transactions,
      gte: (_column: string, value: string) => { transactionStartDate = value; return transactions; },
      lte: () => transactions,
      order: () => transactions,
      limit: async () => ({ data: [], error: null }),
    };
    const plans = {
      select: () => plans,
      eq: () => plans,
      lte: () => plans,
      gte: () => plans,
      limit: async () => ({ data: [], error: null }),
    };
    const client = {
      from: (table: string) => table === "transactions" ? transactions : plans,
      rpc: async () => ({ data: [{ report_id: "report-1", evaluations: 0, alerts: 0 }], error: null }),
    } as never;

    await runDailyFinancialReport(client, "user-1", "2026-09-23", "daily", { version: "test", evaluate: async () => [] });

    expect(transactionSelect).toContain("subcategories(category_id)");
    expect(transactionSelect).not.toContain(", category_id,");
    expect(transactionStartDate).toBe("2025-09-23");
  });

  it("persists report-only findings without turning them into alerts", async () => {
    let reportPayload: Record<string, unknown> | undefined;
    const transactions = {
      select: () => transactions,
      eq: () => transactions,
      gte: () => transactions,
      lte: () => transactions,
      order: () => transactions,
      limit: async () => ({ data: [], error: null }),
    };
    const plans = {
      select: () => plans,
      eq: () => plans,
      lte: () => plans,
      gte: () => plans,
      limit: async () => ({ data: [], error: null }),
    };
    const client = {
      from: (table: string) => table === "transactions" ? transactions : plans,
      rpc: async (_name: string, payload: Record<string, unknown>) => {
        reportPayload = payload;
        return { data: [{ report_id: "report-1", evaluations: 1, alerts: 0 }], error: null };
      },
    } as never;

    await runDailyFinancialReport(client, "user-1", "2026-09-23", "daily", {
      version: "test",
      evaluate: async () => [{ candidate_key: "history:2026-09-23", finding: "insufficient_history", severity: null, explanation: "More transaction history is needed.", source_references: {}, anomaly_score: null }],
    });

    expect(reportPayload?.p_evaluations).toHaveLength(1);
    expect(reportPayload?.p_alerts).toEqual([]);
  });
});

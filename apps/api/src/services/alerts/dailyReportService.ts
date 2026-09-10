import type { SupabaseClient } from "@supabase/supabase-js";
import { anomalyConfig } from "./anomalyConfig.js";

export type ReportCadence = "daily" | "weekly";

export type ModelFinding = {
  candidate_key: string;
  finding: "unusual_transaction" | "budget_overspending" | "insufficient_history" | "model_unavailable" | "no_finding";
  severity: "warning" | "critical" | null;
  explanation: string | null;
  source_references: Record<string, string>;
  anomaly_score: number | null;
};

export interface AnomalyModelAdapter {
  readonly version: string;
  evaluate(input: { user_id: string; report_date: string; transactions: Record<string, unknown>[] }): Promise<ModelFinding[]>;
}

type Transaction = { id: string; amount_centavos: number; transaction_date: string; category_id: string | null; subcategory_id: string | null; merchant_name: string | null };
type Budget = { id: string; period_start: string; period_end: string; budget_allocations: Array<{ id: string; allocated_amount_centavos: number; category_id: string; subcategory_id: string | null }> };

const disabledModel: AnomalyModelAdapter = {
  version: "disabled",
  async evaluate(input) {
    return [{
      candidate_key: `model:${input.report_date}`,
      finding: "model_unavailable",
      severity: null,
      explanation: "No approved anomaly model is enabled.",
      source_references: {},
      anomaly_score: null,
    }];
  },
};

export function normalizeModelFindings(findings: ModelFinding[]): ModelFinding[] {
  return findings.map((finding) => {
    if (finding.finding !== "unusual_transaction" || finding.anomaly_score === null || finding.anomaly_score < anomalyConfig.scoring.anomalousAtScore) return finding;
    return { ...finding, severity: finding.anomaly_score >= anomalyConfig.scoring.criticalAtScore ? "critical" : "warning" };
  });
}

export function buildBudgetOverspendingFindings(budgets: Budget[], transactions: Transaction[], reportDate: string): ModelFinding[] {
  return budgets.flatMap((budget) => (budget.budget_allocations ?? []).flatMap((allocation) => {
    const spent = transactions.filter((transaction) => transaction.transaction_date >= budget.period_start && transaction.transaction_date <= budget.period_end && transaction.category_id === allocation.category_id && (!allocation.subcategory_id || transaction.subcategory_id === allocation.subcategory_id)).reduce((sum, transaction) => sum + transaction.amount_centavos, 0);
    const excess = spent - allocation.allocated_amount_centavos;
    const percent = allocation.allocated_amount_centavos === 0 ? (spent > 0 ? 100 : 0) : (excess / allocation.allocated_amount_centavos) * 100;
    if (percent < anomalyConfig.severity.budgetOverspending.warningAtPercentOverBudget) return [];
    return [{ candidate_key: `budget:${allocation.id}:${reportDate}`, finding: "budget_overspending" as const, severity: percent >= anomalyConfig.severity.budgetOverspending.criticalAtPercentOverBudget ? "critical" : "warning", explanation: `Spending is ${Math.round(percent)}% over this budget allocation.`, source_references: { budget_id: budget.id, budget_allocation_id: allocation.id, category_id: allocation.category_id, ...(allocation.subcategory_id ? { subcategory_id: allocation.subcategory_id } : {}) }, anomaly_score: null }];
  }));
}

export async function runDailyFinancialReport(
  client: SupabaseClient,
  userId: string,
  reportDate: string,
  cadence: ReportCadence,
  model: AnomalyModelAdapter = disabledModel,
): Promise<{ report_id: string; evaluations: number; alerts: number }> {
  const periodStart = new Date(`${reportDate}T00:00:00.000Z`);
  periodStart.setUTCMonth(periodStart.getUTCMonth() - anomalyConfig.history.lookbackMonths);
  const [transactionResult, budgetResult] = await Promise.all([
    client
    .from("transactions")
    .select("id, amount_centavos, transaction_date, category_id, subcategory_id, merchant_name")
    .eq("user_id", userId)
    .eq("status", "posted")
    .eq("deleted", false)
    .eq("transaction_type", "expense")
    .gte("transaction_date", periodStart.toISOString().slice(0, 10))
    .lte("transaction_date", reportDate)
    .order("transaction_date", { ascending: false })
    .limit(5_000),
    client.from("budgets").select("id, period_start, period_end, budget_allocations(id, allocated_amount_centavos, category_id, subcategory_id)").eq("user_id", userId).eq("status", "active").eq("deleted", false).lte("period_start", reportDate).gte("period_end", reportDate).limit(20),
  ]);
  if (transactionResult.error) throw transactionResult.error;
  if (budgetResult.error) throw budgetResult.error;

  const transactions = (transactionResult.data ?? []) as Transaction[];
  const modelFindings = normalizeModelFindings(await model.evaluate({ user_id: userId, report_date: reportDate, transactions }));
  const findings = [...modelFindings, ...buildBudgetOverspendingFindings((budgetResult.data ?? []) as Budget[], transactions, reportDate)];
  const alerts = findings.filter((finding) => anomalyConfig.findings.createAlertsFor.includes(finding.finding as "unusual_transaction" | "budget_overspending")).map((finding) => ({
    category: finding.finding === "unusual_transaction" ? "anomaly_detection" : "budget_overspending",
    severity: finding.severity,
    title: finding.finding === "unusual_transaction" ? "Unusual spending detected" : "Budget limit exceeded",
    body: finding.explanation ?? "A financial report found activity to review.",
    explanation: finding.explanation,
    duplicate_key: `${finding.finding}:${finding.candidate_key}`,
    candidate_key: finding.candidate_key,
    source_references: finding.source_references,
  }));
  const { data, error: writeError } = await client.rpc("write_daily_financial_report", {
    p_user_id: userId,
    p_report_date: reportDate,
    p_cadence: cadence,
    p_model_version: model.version,
    p_period_start: periodStart.toISOString().slice(0, 10),
    p_evaluations: findings,
    p_alerts: alerts,
  });
  if (writeError) throw writeError;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.report_id) throw new Error("daily report write returned no report id");
  return { report_id: result.report_id, evaluations: result.evaluations ?? 0, alerts: result.alerts ?? 0 };
}

export async function retryDailyFinancialReport(
  client: SupabaseClient,
  userId: string,
  reportDate: string,
  cadence: ReportCadence,
): Promise<{ report_id: string; evaluations: number; alerts: number }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < anomalyConfig.retries.maxAttempts; attempt += 1) {
    try {
      return await runDailyFinancialReport(client, userId, reportDate, cadence);
    } catch (error) {
      lastError = error;
      const backoff = anomalyConfig.retries.backoffMs[attempt];
      if (backoff !== undefined) await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw lastError;
}

export async function recordDailyFinancialReportFailure(client: SupabaseClient, userId: string, reportDate: string, cadence: ReportCadence, reason: string): Promise<void> {
  const { error } = await client.rpc("record_daily_financial_report_failure", { p_user_id: userId, p_report_date: reportDate, p_cadence: cadence, p_model_version: "disabled", p_failure_reason: reason.slice(0, 500) });
  if (error) throw error;
}

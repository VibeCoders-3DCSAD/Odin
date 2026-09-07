import type { SupabaseClient } from "@supabase/supabase-js";
import { createAlertProvider } from "./alertProviderFactory.js";
import { AlertRepository } from "./alertRepository.js";
import type { AlertTransaction, BudgetAllocation } from "./types.js";

type TransactionRow = AlertTransaction & { subcategories: { label: string } | { label: string }[] | null };

function mapTransaction(row: TransactionRow): AlertTransaction {
  const subcategory = Array.isArray(row.subcategories) ? row.subcategories[0] : row.subcategories;
  return { ...row, subcategory_label: subcategory?.label ?? null };
}

export async function evaluateAlerts(client: SupabaseClient, userId: string): Promise<{ evaluations: number; alerts: number }> {
  const [transactionResult, budgetResult] = await Promise.all([
    client.from("transactions").select("id, amount_centavos, transaction_date, transaction_type, merchant_name, category_id, subcategory_id, subcategories(label)").eq("user_id", userId).eq("status", "posted").is("deleted_at", null).in("transaction_type", ["expense"]).order("transaction_date", { ascending: false }).limit(500),
    client.from("budgets").select("id, period_start, period_end, budget_allocations(id, allocated_amount_centavos, category_id, subcategory_id)").eq("user_id", userId).eq("status", "active").is("deleted_at", null).order("period_start", { ascending: false }).limit(5),
  ]);
  if (transactionResult.error) throw transactionResult.error;
  if (budgetResult.error) throw budgetResult.error;

  const transactions = ((transactionResult.data ?? []) as unknown as TransactionRow[]).map(mapTransaction);
  const provider = createAlertProvider();
  const repository = new AlertRepository(client, userId);
  const suppressionContext = await repository.listSuppressionContext();
  const existingAmounts = await repository.existingEvaluationAmounts(transactions.map((transaction) => transaction.id));
  let evaluations = 0;
  let alerts = 0;

  for (const transaction of transactions) {
    if (!transaction.subcategory_id) continue;
    if (existingAmounts.get(transaction.id) === transaction.amount_centavos) continue;
    const result = applySuppression(provider.anomaly.evaluate({ transaction, historical_transactions: transactions, now: new Date() }), transaction, suppressionContext);
    const evaluationId = await repository.saveEvaluation(result, transaction.id);
    evaluations += 1;
    if (result.should_alert_user && !result.suppression.suppressed) {
      const key = `${result.category}:${transaction.id}`;
      if (!(await repository.hasRecentDuplicate(key, 24))) {
        await repository.createAlert(result, evaluationId);
        alerts += 1;
      }
    }
  }

  for (const budget of (budgetResult.data ?? []) as Array<{ id: string; period_start: string; period_end: string; budget_allocations: Array<{ id: string; allocated_amount_centavos: number; category_id: string; subcategory_id: string | null }> }>) {
    for (const allocation of budget.budget_allocations ?? []) {
      const input: BudgetAllocation = { budget_id: budget.id, budget_allocation_id: allocation.id, amount_centavos: allocation.allocated_amount_centavos, category_id: allocation.category_id, subcategory_id: allocation.subcategory_id, cycle_start: budget.period_start, cycle_end: budget.period_end };
      const result = applySuppression(provider.overspending.evaluate({ allocation: input, transactions }), undefined, suppressionContext);
      const evaluationId = await repository.saveEvaluation(result);
      evaluations += 1;
      if (result.should_alert_user && !(await repository.hasRecentDuplicate(`${result.category}:${allocation.id}`, 24))) {
        await repository.createAlert(result, evaluationId);
        alerts += 1;
      }
    }
  }
  return { evaluations, alerts };
}

function applySuppression(result: import("./types.js").DetectionResult, transaction: AlertTransaction | undefined, context: { whitelist: Record<string, unknown>[]; rules: Record<string, unknown>[]; preferences: Record<string, unknown>[] }) {
  const preference = context.preferences.find((item) => item.category === result.category);
  const preferenceSuppressed = preference && (preference.in_app_enabled === false || preference.mode === "disabled");
  const whitelistSuppressed = result.category === "anomaly_detection" && transaction && context.whitelist.some((rule) =>
    rule.subcategory_id === transaction.subcategory_id &&
    String(rule.merchant_name).trim().toLowerCase() === String(transaction.merchant_name ?? "").trim().toLowerCase() &&
    (rule.allow_any_amount === true || (typeof rule.base_amount_centavos === "number" && Math.abs(transaction.amount_centavos - rule.base_amount_centavos) <= rule.base_amount_centavos * Number(rule.tolerance_bps ?? 0) / 10000)),
  );
  const ruleSuppressed = context.rules.some((rule) => rule.category === result.category && (!rule.starts_at || Date.parse(String(rule.starts_at)) <= Date.now()) && (!rule.ends_at || Date.parse(String(rule.ends_at)) > Date.now()));
  if (!preferenceSuppressed && !whitelistSuppressed && !ruleSuppressed) return result;
  return { ...result, decision: "no_alert" as const, should_alert_user: false, suppression: { suppressed: true, reason: "rule" as const } };
}

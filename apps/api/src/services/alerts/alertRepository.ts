import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { DetectionResult } from "./types.js";

export type AlertRow = Record<string, unknown>;

type AlertCursor = { triggered_at: string; id: string };

function decodeCursor(cursor: string): AlertCursor {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as AlertCursor;
    if (!value.triggered_at || !value.id || Number.isNaN(Date.parse(value.triggered_at))) throw new Error("invalid cursor");
    return value;
  } catch { throw new Error("invalid alert cursor"); }
}

function encodeCursor(alert: AlertRow): string {
  return Buffer.from(JSON.stringify({ triggered_at: alert.triggered_at, id: alert.id })).toString("base64url");
}

export class AlertRepository {
  constructor(private readonly client: SupabaseClient, private readonly userId: string) {}

  async list(limit: number, cursor?: string): Promise<{ alerts: AlertRow[]; nextCursor: string | null }> {
    let query = this.client
      .from("alerts")
      .select("*, alert_related_entities(*)")
      .eq("user_id", this.userId)
      .neq("status", "cleared")
       .neq("status", "expired")
       .order("triggered_at", { ascending: false })
       .order("id", { ascending: false })
       .limit(limit + 1);
    if (cursor) {
      const decoded = decodeCursor(cursor);
      query = query.or(`triggered_at.lt.${decoded.triggered_at},and(triggered_at.eq.${decoded.triggered_at},id.lt.${decoded.id})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as AlertRow[];
    const page = await this.enrichTransactionRelations(rows.slice(0, limit));
    return { alerts: page, nextCursor: rows.length > limit && page.length ? encodeCursor(page[page.length - 1]!) : null };
  }

  private async enrichTransactionRelations(alerts: AlertRow[]): Promise<AlertRow[]> {
    const transactionIdFor = (alert: AlertRow): string | null => {
      if (typeof alert.transaction_id === "string") return alert.transaction_id;
      const related = Array.isArray(alert.alert_related_entities) ? alert.alert_related_entities as Array<Record<string, unknown>> : [];
      const transaction = related.find((entity) => entity.entity_type === "transaction" && typeof entity.entity_id === "string");
      return typeof transaction?.entity_id === "string" ? transaction.entity_id : null;
    };
    const transactionIds = alerts.map(transactionIdFor).filter((id): id is string => !!id);
    const evaluationIds = alerts.map((alert) => alert.daily_report_evaluation_id).filter((id): id is string => typeof id === "string");
    if (transactionIds.length === 0) return alerts;

    const [{ data: transactions, error: transactionsError }, { data: evaluations, error: evaluationsError }] = await Promise.all([
      this.client.from("transactions").select("id, amount_centavos, transaction_date, subcategory_id, source_account_id").eq("user_id", this.userId).in("id", transactionIds),
      evaluationIds.length > 0
        ? this.client.from("daily_financial_report_evaluations").select("id, anomaly_score, source_references").in("id", evaluationIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (transactionsError) throw transactionsError;
    if (evaluationsError) throw evaluationsError;

    const transactionRows = (transactions ?? []) as Array<{ id: string; amount_centavos: number; transaction_date: string; subcategory_id: string | null; source_account_id: string | null }>;
    const subcategoryIds = transactionRows.map((transaction) => transaction.subcategory_id).filter((id): id is string => !!id);
    const accountIds = transactionRows.map((transaction) => transaction.source_account_id).filter((id): id is string => !!id);
    const [{ data: subcategories, error: subcategoriesError }, { data: accounts, error: accountsError }] = await Promise.all([
      subcategoryIds.length > 0 ? this.client.from("subcategories").select("id, label, category_id").in("id", subcategoryIds) : Promise.resolve({ data: [], error: null }),
      accountIds.length > 0 ? this.client.from("financial_accounts").select("id, name").eq("user_id", this.userId).in("id", accountIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (subcategoriesError) throw subcategoriesError;
    if (accountsError) throw accountsError;

    const subcategoryRows = (subcategories ?? []) as Array<{ id: string; label: string; category_id: string }>;
    const categoryIds = subcategoryRows.map((subcategory) => subcategory.category_id);
    const { data: categories, error: categoriesError } = categoryIds.length > 0
      ? await this.client.from("categories").select("id, label").in("id", categoryIds)
      : { data: [], error: null };
    if (categoriesError) throw categoriesError;

    const transactionsById = new Map(transactionRows.map((transaction) => [transaction.id, transaction]));
    const subcategoriesById = new Map(subcategoryRows.map((subcategory) => [subcategory.id, subcategory]));
    const categoriesById = new Map(((categories ?? []) as Array<{ id: string; label: string }>).map((category) => [category.id, category]));
    const accountsById = new Map(((accounts ?? []) as Array<{ id: string; name: string }>).map((account) => [account.id, account]));
    const evaluationsById = new Map(((evaluations ?? []) as Array<{ id: string; anomaly_score: number | null; source_references: Record<string, unknown> }>).map((evaluation) => [evaluation.id, evaluation]));

    return alerts.map((alert) => {
      const transaction = transactionsById.get(transactionIdFor(alert) ?? "");
      if (!transaction) return alert;
      const subcategory = transaction.subcategory_id ? subcategoriesById.get(transaction.subcategory_id) : undefined;
      const category = subcategory ? categoriesById.get(subcategory.category_id) : undefined;
      const related = Array.isArray(alert.alert_related_entities) ? alert.alert_related_entities as Array<Record<string, unknown>> : [];
      return {
        ...alert,
        alert_related_entities: related.map((entity) => entity.entity_type !== "transaction" || entity.entity_id !== transaction.id ? entity : {
          ...entity,
          label: subcategory?.label ?? category?.label ?? "Uncategorised",
          amount_centavos: transaction.amount_centavos,
          metadata: {
            ...(entity.metadata as Record<string, unknown> ?? {}),
            transaction_date: transaction.transaction_date,
            category_label: category?.label ?? null,
            subcategory_label: subcategory?.label ?? null,
            financial_account_name: transaction.source_account_id ? accountsById.get(transaction.source_account_id)?.name ?? null : null,
            usual_spending_percent: evaluationsById.get(alert.daily_report_evaluation_id as string)?.source_references.usual_spending_percent ?? null,
            usual_spending_centavos: evaluationsById.get(alert.daily_report_evaluation_id as string)?.source_references.usual_spending_centavos ?? null,
          },
        }),
      };
    });
  }

  async get(alertId: string): Promise<AlertRow | null> {
    const { data, error } = await this.client
      .from("alerts")
      .select("*, alert_related_entities(*)")
      .eq("user_id", this.userId)
      .eq("id", alertId)
      .maybeSingle();
    if (error) throw error;
    return data as AlertRow | null;
  }

  async hasRecentDuplicate(duplicateKey: string, cooldownHours: number): Promise<boolean> {
    const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.client
      .from("alerts")
      .select("id")
      .eq("user_id", this.userId)
      .eq("duplicate_key", duplicateKey)
      .gte("triggered_at", since)
      .not("status", "in", "(dismissed,cleared,expired)")
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async listSuppressionContext(): Promise<{ whitelist: AlertRow[]; rules: AlertRow[]; preferences: AlertRow[] }> {
    const [whitelist, rules, preferences] = await Promise.all([
      this.client.from("anomaly_whitelist_rules").select("*").eq("user_id", this.userId).eq("status", "active"),
      this.client.from("alert_suppression_rules").select("*").eq("user_id", this.userId).eq("status", "active"),
      this.client.from("alert_notification_preferences").select("*").eq("user_id", this.userId),
    ]);
    if (whitelist.error) throw whitelist.error;
    if (rules.error) throw rules.error;
    if (preferences.error) throw preferences.error;
    return { whitelist: (whitelist.data ?? []) as AlertRow[], rules: (rules.data ?? []) as AlertRow[], preferences: (preferences.data ?? []) as AlertRow[] };
  }

  async existingEvaluationAmounts(transactionIds: string[]): Promise<Map<string, number>> {
    if (transactionIds.length === 0) return new Map();
    const { data, error } = await this.client.from("anomaly_evaluations").select("transaction_id, amount_centavos").eq("user_id", this.userId).in("transaction_id", transactionIds);
    if (error) throw error;
    return new Map((data ?? []).map((row) => [String((row as { transaction_id: string }).transaction_id), Number((row as { amount_centavos: number }).amount_centavos)]));
  }

  async saveEvaluation(result: DetectionResult, transactionId?: string): Promise<string> {
    if (result.category === "anomaly_detection") {
      if (!transactionId || !result.references.subcategory_id) throw new Error("Anomaly evaluations require source references");
      const { data, error } = await this.client.from("anomaly_evaluations").insert({
        id: randomUUID(),
        user_id: this.userId,
        transaction_id: transactionId,
        profile_label: null,
        history_days: 90,
        subcategory_id: result.references.subcategory_id,
        amount_centavos: result.feature_drivers[0]?.value_centavos ?? 0,
        is_anomaly: result.should_alert_user,
        should_alert_user: result.should_alert_user,
        review_status: result.should_alert_user ? "pending_review" : "not_alerted",
        suppression_reason: result.decision === "insufficient_history" ? "insufficient_history" : null,
        feature_vector: { drivers: result.feature_drivers },
        baseline_snapshot: { drivers: result.feature_drivers },
        explanation: result.explanation,
      }).select("id").single();
      if (error) throw error;
      return String((data as { id: string }).id);
    }

    const driver = result.feature_drivers[0];
    const { data, error } = await this.client.from("overspending_evaluations").insert({
      id: randomUUID(),
      user_id: this.userId,
      budget_id: result.references.budget_id,
      budget_allocation_id: result.references.budget_allocation_id,
      subcategory_id: result.references.subcategory_id,
      actual_amount_centavos: driver?.value_centavos ?? 0,
      budgeted_amount_centavos: driver?.baseline_centavos ?? 0,
      overspent_amount_centavos: Math.max(0, (driver?.value_centavos ?? 0) - (driver?.baseline_centavos ?? 0)),
      overspent_percent_bps: Math.max(0, (driver?.deviation_percent ?? 0) * 100),
      should_alert_user: result.should_alert_user,
      explanation: result.explanation,
      threshold_snapshot: { driver },
    }).select("id").single();
    if (error) throw error;
    return String((data as { id: string }).id);
  }

  async createAlert(result: DetectionResult, evaluationId: string): Promise<AlertRow> {
    const isAnomaly = result.category === "anomaly_detection";
    const duplicateKey = `${result.category}:${result.references.transaction_id ?? result.references.budget_allocation_id ?? evaluationId}`;
    const severity = result.severity === "low" ? "informational" : result.severity === "medium" ? "warning" : "critical";
    const { data, error } = await this.client.from("alerts").insert({
      id: randomUUID(),
      user_id: this.userId,
      category: result.category,
      source_type: isAnomaly ? "isolation_forest" : "budget_overspending_rule",
      severity,
      status: "unread",
      title: isAnomaly ? "Unusual spending detected" : "Budget limit exceeded",
      body: result.explanation,
      explanation: result.explanation,
      action_label: isAnomaly ? "Review transaction" : "Review budget",
      route_name: isAnomaly ? "transactions" : "budgeting",
      transaction_id: result.references.transaction_id ?? null,
      subcategory_id: result.references.subcategory_id ?? null,
      budget_id: result.references.budget_id ?? null,
      anomaly_evaluation_id: isAnomaly ? evaluationId : null,
      overspending_evaluation_id: isAnomaly ? null : evaluationId,
      duplicate_key: duplicateKey,
      metadata: { feature_drivers: result.feature_drivers, merchant_name: result.references.merchant_name ?? null },
    }).select("*, alert_related_entities(*)").single();
    if (error) throw error;
    const alert = data as AlertRow;
    const { error: eventError } = await this.client.from("alert_events").insert({
      alert_id: alert.id,
      actor_user_id: this.userId,
      action: "created",
      payload: { category: result.category },
    });
    if (eventError) throw eventError;
    return alert;
  }

  async update(alertId: string, patch: Record<string, unknown>): Promise<AlertRow> {
    const { data, error } = await this.client.from("alerts").update(patch).eq("id", alertId).eq("user_id", this.userId).select("*, alert_related_entities(*)").single();
    if (error) throw error;
    return data as AlertRow;
  }

  async event(alertId: string, action: string, payload: Record<string, unknown> = {}): Promise<void> {
    const { error } = await this.client.from("alert_events").insert({ alert_id: alertId, actor_user_id: this.userId, action, payload });
    if (error) throw error;
  }

  async createWhitelist(alert: AlertRow): Promise<void> {
    const { error } = await this.client.from("anomaly_whitelist_rules").insert({
      user_id: this.userId,
      created_from_alert_id: alert.id,
      created_from_anomaly_evaluation_id: alert.anomaly_evaluation_id,
      merchant_name: String((alert.metadata && (alert.metadata as Record<string, unknown>).merchant_name) ?? "Expected spending"),
      subcategory_id: alert.subcategory_id,
      allow_any_amount: true,
    });
    if (error) throw error;
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { DetectionResult } from "./types.js";

export type AlertRow = Record<string, unknown>;

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
      .limit(limit + 1);
    if (cursor) query = query.lt("triggered_at", cursor);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as AlertRow[];
    const page = rows.slice(0, limit);
    return { alerts: page, nextCursor: rows.length > limit ? String(page[page.length - 1]?.triggered_at ?? "") : null };
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
      const { data: assignment, error: assignmentError } = await this.client
        .from("financial_profile_assignments")
        .select("profile_label")
        .eq("user_id", this.userId)
        .eq("is_active", true)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) throw new Error("Anomaly evaluations require an active financial profile assignment");
      const { data, error } = await this.client.from("anomaly_evaluations").insert({
        id: randomUUID(),
        user_id: this.userId,
        transaction_id: transactionId,
        profile_label: assignment.profile_label,
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

import { Router } from "express";
import type { Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { AlertRepository } from "../services/alerts/alertRepository.js";

const router = Router();
const ACTIONS = ["read", "acknowledge", "dismiss", "snooze", "expected", "unexpected"] as const;
const CONFIRMATION_TOKEN = "CLEAR_ALERTS";

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  try {
    const limit = Math.max(1, Math.min(Number(request.query.limit) || 20, 50));
    const result = await new AlertRepository(request.supabase!, request.userId!).list(limit, typeof request.query.cursor === "string" ? request.query.cursor : undefined);
    response.json({ alerts: result.alerts.map(withActions), next_cursor: result.nextCursor, has_more: !!result.nextCursor });
  } catch (error) {
    console.error("Alert list failed", { operation: "alert_list", user_id: request.userId, error });
    response.status(500).json({ error: "Internal Server Error", message: "Alerts are unavailable." });
  }
});

router.get("/:alertId", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const alertId = typeof request.params.alertId === "string" ? request.params.alertId : "";
  if (!alertId) { response.status(400).json({ error: "Bad Request", message: "Alert id is required." }); return; }
  try {
    const alert = await new AlertRepository(request.supabase!, request.userId!).get(alertId);
    if (!alert) { response.status(404).json({ error: "Not Found", message: "Alert not found." }); return; }
    response.json({ alert: withActions(alert) });
  } catch (error) {
    console.error("Alert detail failed", { operation: "alert_detail", user_id: request.userId, alert_id: request.params.alertId, error });
    response.status(500).json({ error: "Internal Server Error", message: "Alert details are unavailable." });
  }
});

router.patch("/:alertId", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const alertId = typeof request.params.alertId === "string" ? request.params.alertId : "";
  if (!alertId) { response.status(400).json({ error: "Bad Request", message: "Alert id is required." }); return; }
  const action = request.body?.action;
  if (!ACTIONS.includes(action)) { response.status(400).json({ error: "Bad Request", message: "Unsupported alert action." }); return; }
  const repository = new AlertRepository(request.supabase!, request.userId!);
  try {
    const current = await repository.get(alertId);
    if (!current) { response.status(404).json({ error: "Not Found", message: "Alert not found." }); return; }
    if (current.status === "dismissed" || current.status === "cleared" || current.status === "expired") { response.status(409).json({ error: "Conflict", message: "This alert is no longer actionable." }); return; }
    if (!allowedActions(current).includes(action)) { response.status(400).json({ error: "Bad Request", message: "That action is not valid for this alert." }); return; }
    if (action === "snooze" && (!request.body.snooze_until || Number.isNaN(Date.parse(request.body.snooze_until)))) { response.status(400).json({ error: "Bad Request", message: "A valid snooze timestamp is required." }); return; }
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = action === "read" ? { status: "read", read_at: now } : action === "acknowledge" ? { status: "acknowledged", acknowledged_at: now } : action === "dismiss" ? { status: "dismissed", dismissed_at: now } : action === "snooze" ? { status: "acknowledged", remind_at: request.body.snooze_until } : action === "unexpected" ? { status: "acknowledged", acknowledged_at: now } : { status: "acknowledged", acknowledged_at: now };
    const updated = await repository.update(alertId, patch);
    await repository.event(alertId, action === "expected" ? "marked_expected" : action === "unexpected" ? "marked_unexpected" : action === "snooze" ? "remind_later" : action === "read" ? "opened" : action, { requested_action: action });
    if (action === "expected" && request.body.create_whitelist === true) await repository.createWhitelist(current);
    response.json({ alert: withActions(updated) });
  } catch (error) {
    console.error("Alert action failed", { operation: "alert_action", user_id: request.userId, alert_id: request.params.alertId, action, error });
    response.status(500).json({ error: "Internal Server Error", message: "Unable to update this alert." });
  }
});

router.post("/clear", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  if (request.body?.confirmation_token !== CONFIRMATION_TOKEN) { response.status(400).json({ error: "Bad Request", message: "Explicit confirmation is required to clear alerts." }); return; }
  try {
    const now = new Date().toISOString();
    const { data, error } = await request.supabase!.from("alerts").update({ status: "cleared", cleared_at: now }).eq("user_id", request.userId!).neq("status", "cleared").select("id");
    if (error) throw error;
    if (data?.length) {
      const { error: eventError } = await request.supabase!.from("alert_events").insert(data.map((alert) => ({ alert_id: (alert as { id: string }).id, actor_user_id: request.userId!, action: "cleared" })));
      if (eventError) throw eventError;
    }
    response.json({ cleared: data?.length ?? 0 });
  } catch (error) {
    console.error("Alert clear failed", { operation: "alert_clear", user_id: request.userId, error });
    response.status(500).json({ error: "Internal Server Error", message: "Unable to clear alerts." });
  }
});

function withActions(alert: Record<string, unknown>) {
  const status = String(alert.status);
  const severity = alert.severity === "informational" ? "low" : alert.severity === "warning" ? "medium" : alert.severity;
  return { ...alert, severity, related_entities: alert.alert_related_entities ?? [], remote_revision: String(alert.updated_at ?? alert.triggered_at ?? ""), allowed_actions: allowedActions(alert, status) };
}

function allowedActions(alert: Record<string, unknown>, status = String(alert.status)) {
  if (status === "dismissed" || status === "cleared" || status === "expired") return [] as readonly string[];
  const actions = ["read", "acknowledge", "dismiss", "snooze"];
  if (alert.category === "anomaly_detection") actions.push("expected", "unexpected");
  return actions;
}

export default router;

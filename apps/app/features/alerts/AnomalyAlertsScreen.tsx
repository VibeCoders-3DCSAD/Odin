import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ArrowLeft, BellRinging, Check, Warning } from "phosphor-react-native";
import { clearAlerts, getAlerts, updateAlert } from "./api";
import type { Alert, AlertAction } from "./types";
import { getActiveAlerts, replaceAlertPage } from "../../local-db/repositories/alerts";

type Props = { userId: string; accessToken: string; onBack: () => void; onNavigate?: (page: string) => void };
const P = { ink: "#1B1C1A", muted: "#6B7A6F", brand: "#013220", line: "#EAEAE6", card: "#F8EFDC", error: "#D9001F", warning: "#C25E00" };

export default function AnomalyAlertsScreen({ userId, accessToken, onBack, onNavigate }: Props) {
  const [alerts, setAlerts] = useState<Array<Alert & { stale?: boolean }>>([]);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmExpected, setConfirmExpected] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    try {
      const cached = await getActiveAlerts(userId);
      setAlerts(cached);
      setSelected((current) => current ? cached.find((alert) => alert.id === current.id) ?? current : null);
    } catch {
      setError("Alerts are unavailable. Refresh to try again.");
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    setRefreshing(true); setError(null);
    try {
      const result = await getAlerts(accessToken, undefined, 50);
      if (!result.response.ok || !result.body.alerts) throw new Error("refresh_failed");
      await replaceAlertPage(userId, result.body.alerts, { replace_before: null });
      await load();
    } catch { setError("Could not refresh alerts. Showing cached alerts if available."); await load(); }
    finally { setRefreshing(false); }
  }

  async function clearAll() {
    setRefreshing(true);
    try { const result = await clearAlerts(accessToken); if (!result.response.ok) throw new Error("clear_failed"); setConfirmClear(false); await load(); }
    catch { setError("Alerts could not be cleared. Try again."); }
    finally { setRefreshing(false); }
  }

  async function act(alert: Alert, action: AlertAction, createWhitelist = false) {
    setPendingId(alert.id);
    try {
      const result = await updateAlert(accessToken, alert.id, action, undefined, createWhitelist);
      if (!result.response.ok || !result.body.alert) throw new Error("action_failed");
      await replaceAlertPage(userId, [result.body.alert]);
      setConfirmExpected(null);
      await load();
    } catch { setError("That alert could not be updated. Try again."); }
    finally { setPendingId(null); }
  }

  if (selected) return <Detail alert={selected} pending={pendingId === selected.id} confirmExpected={confirmExpected === selected.id} onConfirmExpected={() => act(selected, "expected", true)} onExpected={() => setConfirmExpected(selected.id)} onAction={(action) => act(selected, action)} onBack={() => setSelected(null)} onNavigate={onNavigate} />;

  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}><ArrowLeft size={18} color={P.ink} weight="bold" /><Text style={{ color: P.muted }}>Dashboard</Text></Pressable>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><BellRinging size={24} color={P.brand} weight="fill" /><View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 21, color: P.ink }}>Anomaly Alerts</Text><Text style={{ color: P.muted, marginTop: 2 }}>Unusual activity and overspending</Text></View></View>
    <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 14 }}><Pressable accessibilityRole="button" accessibilityLabel="Refresh alerts" onPress={refresh} disabled={refreshing}><Text style={{ color: P.brand, fontWeight: "700" }}>{refreshing ? "Refreshing..." : "Refresh"}</Text></Pressable>{alerts.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear all alerts" onPress={() => setConfirmClear(true)} disabled={refreshing}><Text style={{ color: P.error, fontWeight: "700" }}>Clear all</Text></Pressable> : null}</View>
    {confirmClear ? <View style={{ marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#FFF0F2" }}><Text style={{ color: P.ink }}>Clear all alerts? This cannot be undone.</Text><View style={{ flexDirection: "row", gap: 14, marginTop: 10 }}><Pressable accessibilityRole="button" accessibilityLabel="Confirm clear all alerts" onPress={clearAll}><Text style={{ color: P.error, fontWeight: "800" }}>Confirm clear</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Cancel clear all alerts" onPress={() => setConfirmClear(false)}><Text style={{ color: P.muted, fontWeight: "700" }}>Cancel</Text></Pressable></View></View> : null}
    {error ? <View style={{ marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#FFF0F2" }}><Text style={{ color: P.error }}>{error}</Text></View> : null}
    {alerts.some((alert) => alert.stale) ? <Text style={{ marginTop: 14, color: P.muted }}>Showing cached alerts. Last update is unavailable.</Text> : null}
    {loading && alerts.length === 0 ? <ActivityIndicator color={P.brand} style={{ marginTop: 44 }} /> : alerts.length === 0 ? <View style={{ marginTop: 36, alignItems: "center", padding: 22, borderRadius: 18, backgroundColor: P.card }}><Check size={30} color={P.brand} weight="bold" /><Text style={{ marginTop: 10, fontWeight: "800", color: P.ink }}>You are all clear</Text><Text style={{ marginTop: 5, textAlign: "center", color: P.muted }}>No unusual spending or budget overspending needs your attention.</Text></View> : <View style={{ gap: 10, marginTop: 18 }}>{alerts.map((alert) => <AlertRow key={alert.id} alert={alert} pending={pendingId === alert.id} onPress={() => setSelected(alert)} />)}</View>}
  </View>;
}

function AlertRow({ alert, pending, onPress }: { alert: Alert; pending: boolean; onPress: () => void }) {
  const critical = alert.severity === "critical";
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${alert.title}`} onPress={onPress} style={{ padding: 16, borderRadius: 18, borderWidth: 1, borderColor: P.line, backgroundColor: "#FFFFFF", opacity: pending ? 0.55 : 1 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Warning size={18} color={critical ? P.error : P.warning} weight="fill" /><Text style={{ flex: 1, fontWeight: "800", color: P.ink }}>{alert.title}</Text><Text style={{ color: P.muted, fontSize: 11 }}>{alert.status === "unread" ? "NEW" : ""}</Text></View><Text style={{ color: P.muted, lineHeight: 19, marginTop: 8 }}>{alert.body}</Text></Pressable>;
}

function Detail({ alert, pending, confirmExpected, onConfirmExpected, onExpected, onAction, onBack, onNavigate }: { alert: Alert; pending: boolean; confirmExpected: boolean; onConfirmExpected: () => void; onExpected: () => void; onAction: (action: AlertAction) => void; onBack: () => void; onNavigate?: (page: string) => void }) {
  return <View><Pressable accessibilityRole="button" accessibilityLabel="Back to alerts" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}><ArrowLeft size={18} color={P.ink} weight="bold" /><Text style={{ color: P.muted }}>All alerts</Text></Pressable><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, color: P.ink }}>{alert.title}</Text><Text style={{ color: P.muted, marginTop: 5 }}>{new Date(alert.triggered_at).toLocaleString("en-PH")}</Text><View style={{ marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: P.card }}><Text style={{ color: P.ink, lineHeight: 21 }}>{alert.body}</Text>{alert.explanation ? <Text style={{ color: P.muted, lineHeight: 20, marginTop: 12 }}>Why this appeared: {alert.explanation}</Text> : null}</View><View style={{ gap: 10, marginTop: 18 }}>{alert.status === "unread" ? <Action label="Mark as read" disabled={pending} onPress={() => onAction("read")} /> : null}<Action label="Acknowledge" disabled={pending} onPress={() => onAction("acknowledge")} /><Action label="Dismiss" disabled={pending} onPress={() => onAction("dismiss")} /><Action label="Mark expected" disabled={pending} onPress={onExpected} />{confirmExpected ? <View style={{ padding: 14, borderRadius: 14, backgroundColor: "#FFF0F2" }}><Text style={{ color: P.ink }}>Create a rule to suppress matching future spending?</Text><View style={{ flexDirection: "row", gap: 14, marginTop: 10 }}><Pressable accessibilityRole="button" accessibilityLabel="Confirm expected spending" onPress={onConfirmExpected}><Text style={{ color: P.error, fontWeight: "800" }}>Confirm</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Cancel expected spending" onPress={onBack}><Text style={{ color: P.muted, fontWeight: "700" }}>Cancel</Text></Pressable></View></View> : null}<Action label="View related record" disabled={pending || !alert.route_name} onPress={() => onNavigate?.(alert.route_name ?? "anomaly-alerts")} /></View></View>;
}

function Action({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: P.line, justifyContent: "center", alignItems: "center" }}><Text style={{ color: P.brand, fontWeight: "800" }}>{label}</Text></Pressable>; }

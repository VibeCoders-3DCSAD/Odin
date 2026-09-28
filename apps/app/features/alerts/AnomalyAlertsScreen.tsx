import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ArrowLeft, BellRinging, Check } from "phosphor-react-native";
import { clearAlerts, getAlerts, updateAlert } from "./api";
import type { Alert } from "./types";
import { getActiveAlerts, replaceAlertPage } from "../../local-db/repositories/alerts";

type Props = { userId: string; accessToken: string; onBack?: () => void; onNavigate?: (page: string) => void };
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
  const insights = alerts.filter(hasTransactionInsight).sort((first, second) => transactionDate(second).localeCompare(transactionDate(first)));

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

  async function markExpected(alert: Alert) {
    setPendingId(alert.id);
    try {
      const result = await updateAlert(accessToken, alert.id, "expected", undefined, true);
      if (!result.response.ok || !result.body.alert) throw new Error("expected_failed");
      await replaceAlertPage(userId, [result.body.alert]);
      setConfirmExpected(null);
      await load();
    } catch { setError("This insight could not be marked as expected. Try again."); }
    finally { setPendingId(null); }
  }

  if (selected) return <Detail alert={selected} pending={pendingId === selected.id} confirmExpected={confirmExpected === selected.id} onExpected={() => setConfirmExpected(selected.id)} onConfirmExpected={() => markExpected(selected)} onBack={() => setSelected(null)} />;

  return <View>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back to financial reports" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}><ArrowLeft size={18} color={P.ink} weight="bold" /><Text style={{ color: P.muted }}>Financial Reports</Text></Pressable> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><BellRinging size={24} color={P.brand} weight="fill" /><View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 21, color: P.ink }}>Unusual Spendings</Text><Text style={{ color: P.muted, marginTop: 2 }}>Transactions worth a closer look</Text></View></View>
    <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 14 }}><Pressable accessibilityRole="button" accessibilityLabel="Refresh alerts" onPress={refresh} disabled={refreshing}><Text style={{ color: P.brand, fontWeight: "700" }}>{refreshing ? "Refreshing..." : "Refresh"}</Text></Pressable>{alerts.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear all alerts" onPress={() => setConfirmClear(true)} disabled={refreshing}><Text style={{ color: P.error, fontWeight: "700" }}>Clear all</Text></Pressable> : null}</View>
    {confirmClear ? <View style={{ marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#FFF0F2" }}><Text style={{ color: P.ink }}>Clear all alerts? This cannot be undone.</Text><View style={{ flexDirection: "row", gap: 14, marginTop: 10 }}><Pressable accessibilityRole="button" accessibilityLabel="Confirm clear all alerts" onPress={clearAll}><Text style={{ color: P.error, fontWeight: "800" }}>Confirm clear</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Cancel clear all alerts" onPress={() => setConfirmClear(false)}><Text style={{ color: P.muted, fontWeight: "700" }}>Cancel</Text></Pressable></View></View> : null}
    {error ? <View style={{ marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#FFF0F2" }}><Text style={{ color: P.error }}>{error}</Text></View> : null}
    {alerts.some((alert) => alert.stale) ? <Text style={{ marginTop: 14, color: P.muted }}>Showing cached alerts. Last update is unavailable.</Text> : null}
    {loading && alerts.length === 0 ? <ActivityIndicator color={P.brand} style={{ marginTop: 44 }} /> : insights.length === 0 ? <View style={{ marginTop: 36, alignItems: "center", padding: 22, borderRadius: 18, backgroundColor: P.card }}><Check size={30} color={P.brand} weight="bold" /><Text style={{ marginTop: 10, fontWeight: "800", color: P.ink }}>No complete spending insights</Text><Text style={{ marginTop: 5, textAlign: "center", color: P.muted }}>Refresh after recording transactions to view their amount, category, account, and deviation.</Text></View> : <View style={{ gap: 10, marginTop: 18 }}>{insights.map((alert) => <AlertRow key={alert.id} alert={alert} onPress={() => setSelected(alert)} />)}</View>}
  </View>;
}

function hasTransactionInsight(alert: Alert): boolean {
  const transaction = alert.related_entities.find((entity) => entity.entity_type === "transaction");
  return typeof transaction?.amount_centavos === "number"
    && typeof transaction.metadata.category_label === "string"
    && typeof transaction.metadata.financial_account_name === "string"
    && typeof transaction.metadata.transaction_date === "string";
}

function transactionDate(alert: Alert): string {
  const transaction = alert.related_entities.find((entity) => entity.entity_type === "transaction");
  const date = transaction?.metadata.transaction_date;
  return typeof date === "string" ? date : "";
}

function AlertRow({ alert, onPress }: { alert: Alert; onPress: () => void }) {
  const transaction = alert.related_entities.find((entity) => entity.entity_type === "transaction");
  const metadata = transaction?.metadata ?? {};
  const amount = transaction?.amount_centavos == null ? "Amount unavailable" : `PHP ${(transaction.amount_centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const recordedDate = typeof metadata.transaction_date === "string" ? new Date(`${metadata.transaction_date}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Date unavailable";
  const category = typeof metadata.category_label === "string" ? metadata.category_label : transaction?.label ?? "Uncategorised";
  const account = typeof metadata.financial_account_name === "string" ? metadata.financial_account_name : "Account unavailable";
  const usualSpendingPercent = typeof metadata.usual_spending_percent === "number"
    ? metadata.usual_spending_percent
    : typeof metadata.usual_spending_percent === "string" ? Number(metadata.usual_spending_percent) : null;
  const usualSpendingCentavos = typeof metadata.usual_spending_centavos === "number"
    ? metadata.usual_spending_centavos
    : typeof metadata.usual_spending_centavos === "string" ? Number(metadata.usual_spending_centavos) : null;
  const usualSpending = typeof usualSpendingCentavos === "number" && Number.isFinite(usualSpendingCentavos) && usualSpendingCentavos > 0
    ? `Usually PHP ${(usualSpendingCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
  const deviation = typeof usualSpendingPercent === "number" && Number.isFinite(usualSpendingPercent)
    ? `${Math.abs(usualSpendingPercent).toFixed(2)}% ${usualSpendingPercent >= 0 ? "higher" : "lower"} than usual`
    : "Outside your usual spending range";
  const deviationLabel = typeof usualSpendingPercent === "number" && Number.isFinite(usualSpendingPercent)
    ? usualSpendingPercent >= 0 ? "HIGHER THAN USUAL" : "LOWER THAN USUAL"
    : "UNUSUAL SPENDING";
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open spending insight for ${amount}`} onPress={onPress} style={{ padding: 17, borderRadius: 18, borderWidth: 1, borderColor: P.line, backgroundColor: "#FFFFFF" }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 20, fontWeight: "800" }}>{amount}</Text><Text style={{ color: alert.severity === "critical" ? P.error : P.warning, fontFamily: "Manrope", fontSize: 11, fontWeight: "800" }}>{deviationLabel}</Text></View>
    {usualSpending ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 3 }}>{usualSpending}</Text> : null}
    <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 14, fontWeight: "800", marginTop: 14 }}>{category}</Text>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 3 }}>{account} · {recordedDate}</Text>
    <View style={{ borderTopColor: P.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 11 }}><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Usual spending</Text><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>{deviation}</Text></View>
  </Pressable>;
}

function Detail({ alert, pending, confirmExpected, onExpected, onConfirmExpected, onBack }: { alert: Alert; pending: boolean; confirmExpected: boolean; onExpected: () => void; onConfirmExpected: () => void; onBack: () => void }) {
  return <View><Pressable accessibilityRole="button" accessibilityLabel="Back to alerts" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}><ArrowLeft size={18} color={P.ink} weight="bold" /><Text style={{ color: P.muted }}>All insights</Text></Pressable><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, color: P.ink }}>{alert.title}</Text><Text style={{ color: P.muted, marginTop: 5 }}>{new Date(alert.triggered_at).toLocaleString("en-PH")}</Text><View style={{ marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: P.card }}><Text style={{ color: P.ink, lineHeight: 21 }}>{alert.body}</Text>{alert.explanation ? <Text style={{ color: P.muted, lineHeight: 20, marginTop: 12 }}>Why this appeared: {alert.explanation}</Text> : null}</View><View style={{ marginTop: 18 }}><Pressable accessibilityRole="button" accessibilityLabel="Mark expected" disabled={pending} onPress={onExpected} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: P.line, justifyContent: "center", alignItems: "center" }}><Text style={{ color: P.brand, fontWeight: "800" }}>Mark expected</Text></Pressable>{confirmExpected ? <View style={{ marginTop: 10, padding: 14, borderRadius: 14, backgroundColor: "#FFF0F2" }}><Text style={{ color: P.ink }}>Create a rule to suppress matching future spending?</Text><View style={{ flexDirection: "row", gap: 14, marginTop: 10 }}><Pressable accessibilityRole="button" accessibilityLabel="Confirm expected spending" onPress={onConfirmExpected}><Text style={{ color: P.error, fontWeight: "800" }}>Confirm</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Cancel expected spending" onPress={onBack}><Text style={{ color: P.muted, fontWeight: "700" }}>Cancel</Text></Pressable></View></View> : null}</View></View>;
}

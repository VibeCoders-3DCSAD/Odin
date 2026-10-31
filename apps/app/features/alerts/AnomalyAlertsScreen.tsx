import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ArrowLeft, BellRinging, Check } from "phosphor-react-native";
import { answerUnusualSpending, listPersistedUnusualSpendings, type SpendingRecurrence, type UnusualSpendingInsight } from "../../local-db/repositories/alerts/unusualSpending";
import RecurrenceQuestion from "./RecurrenceQuestion";
import { recurrenceAnswer } from "./recurrenceOptions";
import { formatPhp } from "../../lib/format/money";

type Props = { userId: string; deviceId: string; onBack?: () => void; initialTransactionId?: string };
// Alerts are listed five at a time; each press of "Show more" reveals the next five.
const ALERT_PAGE_SIZE = 5;
const P = { ink: "#1B1C1A", muted: "#6B7A6F", brand: "#013220", line: "#EAEAE6", card: "#F8EFDC", warning: "#C25E00" };

export default function AnomalyAlertsScreen({ userId, deviceId, onBack, initialTransactionId }: Props) {
  const [alerts, setAlerts] = useState<UnusualSpendingInsight[]>([]);
  const [selected, setSelected] = useState<UnusualSpendingInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openedInitial, setOpenedInitial] = useState(false);
  const [shown, setShown] = useState(ALERT_PAGE_SIZE);
  const nextCount = Math.min(ALERT_PAGE_SIZE, alerts.length - shown);

  useEffect(() => {
    if (!loading && !openedInitial && initialTransactionId) {
      setSelected(alerts.find((alert) => alert.transactionId === initialTransactionId) ?? null);
      setOpenedInitial(true);
    }
  }, [alerts, initialTransactionId, loading, openedInitial]);

  const load = useCallback(async () => {
    try {
      const refreshed = (await listPersistedUnusualSpendings(userId))
        .filter((insight) => insight.recurrence !== "yearly").reverse();
      setAlerts(refreshed);
      setSelected((current) => current ? refreshed.find((alert) => alert.transactionId === current.transactionId) ?? null : null);
      setError(null);
    } catch {
      setError("Local spending insights are unavailable. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function answer(alert: UnusualSpendingInsight, recurrence: SpendingRecurrence, months?: number[]) {
    await answerUnusualSpending(userId, deviceId, alert.transactionId, recurrence, months);
    await load();
  }

  if (selected) return <Detail alert={selected} onBack={() => setSelected(null)} onAnswer={(recurrence, months) => answer(selected, recurrence, months)} />;

  return <View>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back to financial reports" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}><ArrowLeft size={18} color={P.ink} weight="bold" /><Text style={{ color: P.muted }}>Financial Reports</Text></Pressable> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><BellRinging size={24} color={P.brand} weight="fill" /><View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 21, color: P.ink }}>Spending alerts</Text><Text style={{ color: P.muted, marginTop: 2 }}>Based on your saved local spending insights</Text></View></View>
    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 14 }}><Pressable accessibilityRole="button" accessibilityLabel="Refresh spending alerts" onPress={refresh} disabled={refreshing}><Text style={{ color: P.brand, fontWeight: "700" }}>{refreshing ? "Refreshing..." : "Refresh"}</Text></Pressable></View>
    {error ? <View style={{ marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#FFF0F2" }}><Text style={{ color: P.warning }}>{error}</Text></View> : null}
    {loading ? <ActivityIndicator color={P.brand} style={{ marginTop: 44 }} /> : alerts.length === 0 ? <View style={{ marginTop: 36, alignItems: "center", padding: 22, borderRadius: 18, backgroundColor: P.card }}><Check size={30} color={P.brand} weight="bold" /><Text style={{ marginTop: 10, fontWeight: "800", color: P.ink }}>No unusual spending found</Text><Text style={{ marginTop: 5, textAlign: "center", color: P.muted }}>Budgie will show saved unusual-spending insights here.</Text></View> : <View style={{ gap: 10, marginTop: 18 }}>
      {alerts.slice(0, shown).map((alert) => <AlertRow key={alert.transactionId} alert={alert} onPress={() => setSelected(alert)} />)}
      {nextCount > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={`Show ${nextCount} more spending alert${nextCount === 1 ? "" : "s"}`} onPress={() => setShown((count) => count + ALERT_PAGE_SIZE)} style={{ alignItems: "center", paddingVertical: 12 }}><Text style={{ color: P.brand, fontFamily: "Manrope", fontWeight: "700" }}>Show {nextCount} more</Text></Pressable> : null}
    </View>}
  </View>;
}

function AlertRow({ alert, onPress }: { alert: UnusualSpendingInsight; onPress: () => void }) {
  const date = new Date(alert.transactionDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open spending alert for ${alert.subcategoryLabel}`} onPress={onPress} style={{ padding: 17, borderRadius: 18, borderWidth: 1, borderColor: P.line, backgroundColor: "#FFFFFF" }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 16, fontWeight: "800", flex: 1 }}>Unusual {alert.subcategoryLabel} spending</Text><Text style={{ color: P.warning, fontFamily: "Manrope", fontSize: 11, fontWeight: "800" }}>HIGHER</Text></View>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 13, lineHeight: 19, marginTop: 7 }}>{formatPhp(alert.amountCentavos)} is above your usual range of {formatPhp(alert.lowerBoundCentavos)} to {formatPhp(alert.upperBoundCentavos)}.</Text>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 12 }}>{date}</Text>
  </Pressable>;
}

function Detail({ alert, onBack, onAnswer }: { alert: UnusualSpendingInsight; onBack: () => void; onAnswer: (recurrence: SpendingRecurrence, months?: number[]) => Promise<void> }) {
  return <View><Pressable accessibilityRole="button" accessibilityLabel="Back to alerts" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}><ArrowLeft size={18} color={P.ink} weight="bold" /><Text style={{ color: P.muted }}>All alerts</Text></Pressable><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, color: P.ink }}>Unusual {alert.subcategoryLabel} spending</Text><Text style={{ color: P.muted, marginTop: 5 }}>{new Date(alert.transactionDate).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</Text><View style={{ marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: P.card }}><Text style={{ color: P.ink, lineHeight: 21 }}>{formatPhp(alert.amountCentavos)} is outside your usual spending range for {alert.subcategoryLabel}. Your usual spending is {formatPhp(alert.usualSpendingCentavos)}, based on {alert.usableHistoryCount} earlier expenses.</Text><Text style={{ color: P.ink, fontWeight: "800", marginTop: 12 }}>{formatPhp(alert.amountCentavos)}</Text>{alert.accountName ? <Text style={{ color: P.muted, marginTop: 5 }}>{alert.accountName}</Text> : null}</View>
    {alert.recurrence
      ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}><Check size={18} color={P.brand} weight="bold" /><Text style={{ color: P.muted, flex: 1 }}>{recurrenceAnswer(alert.recurrence, alert.subcategoryLabel, alert.recurrenceMonths)}</Text></View>
      : <View style={{ gap: 10, marginTop: 16 }}><Text style={{ color: P.ink, fontWeight: "700" }}>Will you be making this expense again?</Text><RecurrenceQuestion transactionDate={alert.transactionDate} onAnswer={onAnswer} /></View>}
  </View>;
}

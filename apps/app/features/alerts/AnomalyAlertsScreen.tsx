import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ArrowLeft, BellRinging, Check } from "phosphor-react-native";
import { listUnusualSpendings, type UnusualSpendingInsight } from "../../local-db/repositories/unusualSpending";

type Props = { userId: string; accessToken: string; onBack?: () => void; onNavigate?: (page: string) => void };
const P = { ink: "#1B1C1A", muted: "#6B7A6F", brand: "#013220", line: "#EAEAE6", card: "#F8EFDC", warning: "#C25E00" };

function formatAmount(amountCentavos: number): string {
  return `PHP ${(amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AnomalyAlertsScreen({ userId, onBack }: Props) {
  const [insights, setInsights] = useState<UnusualSpendingInsight[]>([]);
  const [selected, setSelected] = useState<UnusualSpendingInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const nextInsights = await listUnusualSpendings(userId);
      nextInsights.sort((first, second) => second.transactionDate.localeCompare(first.transactionDate));
      setInsights(nextInsights);
      setSelected((current) => current ? nextInsights.find((insight) => insight.transactionId === current.transactionId) ?? null : null);
    } catch {
      setError("Spending insights are unavailable. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    await load();
    setRefreshing(false);
  }

  if (selected) return <Detail insight={selected} onBack={() => setSelected(null)} />;

  return <View>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back to financial reports" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}><ArrowLeft size={18} color={P.ink} weight="bold" /><Text style={{ color: P.muted }}>Financial Reports</Text></Pressable> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><BellRinging size={24} color={P.brand} weight="fill" /><View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 21, color: P.ink }}>Spending insights</Text><Text style={{ color: P.muted, marginTop: 2 }}>Private observations from this device's transaction history</Text></View></View>
    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 14 }}><Pressable accessibilityRole="button" accessibilityLabel="Refresh spending insights" onPress={refresh} disabled={refreshing}><Text style={{ color: P.brand, fontWeight: "700" }}>{refreshing ? "Refreshing..." : "Refresh"}</Text></Pressable></View>
    {error ? <View style={{ marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#FFF0F2" }}><Text style={{ color: P.warning }}>{error}</Text></View> : null}
    {loading ? <ActivityIndicator color={P.brand} style={{ marginTop: 44 }} /> : insights.length === 0 ? <View style={{ marginTop: 36, alignItems: "center", padding: 22, borderRadius: 18, backgroundColor: P.card }}><Check size={30} color={P.brand} weight="bold" /><Text style={{ marginTop: 10, fontWeight: "800", color: P.ink }}>No complete spending insights yet</Text><Text style={{ marginTop: 5, textAlign: "center", color: P.muted }}>More transaction history may be needed before Odin can identify spending patterns.</Text></View> : <View style={{ gap: 10, marginTop: 18 }}>{insights.map((insight) => <InsightRow key={insight.transactionId} insight={insight} onPress={() => setSelected(insight)} />)}</View>}
  </View>;
}

function InsightRow({ insight, onPress }: { insight: UnusualSpendingInsight; onPress: () => void }) {
  const higherThanUsual = insight.amountCentavos > insight.usualSpendingCentavos;
  const recordedDate = new Date(`${insight.transactionDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open spending insight for ${formatAmount(insight.amountCentavos)}`} onPress={onPress} style={{ padding: 17, borderRadius: 18, borderWidth: 1, borderColor: P.line, backgroundColor: "#FFFFFF" }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 20, fontWeight: "800" }}>{formatAmount(insight.amountCentavos)}</Text><Text style={{ color: P.warning, fontFamily: "Manrope", fontSize: 11, fontWeight: "800" }}>{higherThanUsual ? "HIGHER THAN USUAL" : "LOWER THAN USUAL"}</Text></View>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 3 }}>Usually {formatAmount(insight.usualSpendingCentavos)}</Text>
    <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 14, fontWeight: "800", marginTop: 14 }}>{insight.subcategoryLabel}</Text>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12, marginTop: 3 }}>{insight.accountName ?? "Account unavailable"} · {recordedDate}</Text>
  </Pressable>;
}

function Detail({ insight, onBack }: { insight: UnusualSpendingInsight; onBack: () => void }) {
  return <View><Pressable accessibilityRole="button" accessibilityLabel="Back to alerts" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}><ArrowLeft size={18} color={P.ink} weight="bold" /><Text style={{ color: P.muted }}>All insights</Text></Pressable><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 22, color: P.ink }}>Unusual spending detected</Text><Text style={{ color: P.muted, marginTop: 5 }}>{new Date(`${insight.transactionDate}T00:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</Text><View style={{ marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: P.card }}><Text style={{ color: P.ink, lineHeight: 21 }}>{formatAmount(insight.amountCentavos)} is outside your usual spending range for {insight.subcategoryLabel}.</Text><Text style={{ color: P.muted, lineHeight: 20, marginTop: 12 }}>Your usual spending is {formatAmount(insight.usualSpendingCentavos)}. This insight is based only on your earlier expense transactions in this subcategory.</Text></View><View style={{ borderTopColor: P.line, borderTopWidth: 1, marginTop: 18, paddingTop: 12, gap: 5 }}><Text style={{ color: P.muted, fontSize: 12 }}>Usual range</Text><Text style={{ color: P.ink, fontWeight: "800" }}>{formatAmount(insight.lowerBoundCentavos)} to {formatAmount(insight.upperBoundCentavos)}</Text></View></View>;
}

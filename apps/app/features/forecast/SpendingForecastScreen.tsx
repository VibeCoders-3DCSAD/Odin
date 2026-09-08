import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ArrowLeft, Sparkle } from "phosphor-react-native";
import { getSnapshot, upsertSnapshot } from "../../local-db/repositories/dashboardSnapshots";
import type { DashboardSnapshotWithMeta } from "../../local-db/repositories/dashboardSnapshots";
import { listForecastTransactions } from "../../local-db/repositories/forecastTransactions";
import { getForecastContent } from "../dashboard/dashboardSnapshotContent";
import { ForecastPanel } from "../dashboard/components/ForecastPanel";
import { requestForecast } from "./api";
import { ForecastLineChart } from "./ForecastLineChart";
import type { ForecastHorizon, ForecastLevel } from "./types";

type Props = { userId: string; accessToken: string; onBack: () => void };

const HORIZONS: { value: ForecastHorizon; label: string }[] = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "SEMI_MONTHLY", label: "Semi-monthly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];
const LEVELS: { value: ForecastLevel; label: string }[] = [
  { value: "TOTAL", label: "Total" },
  { value: "CATEGORY_GROUP", label: "Groups" },
];

export default function SpendingForecastScreen({ userId, accessToken, onBack }: Props) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshotWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<ForecastHorizon>("MONTHLY");
  const [level, setLevel] = useState<ForecastLevel>("TOTAL");

  const load = useCallback(async () => {
    try { setSnapshot(await getSnapshot(userId, "forecast")); } catch { setError("Forecast information is unavailable."); } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const historicalTransactions = await listForecastTransactions(userId);
      if (historicalTransactions.length === 0) {
        setError("Record a posted income or expense before requesting a forecast.");
        return;
      }
      const result = await requestForecast(accessToken, { historicalTransactions, forecastHorizon: horizon, forecastLevel: level });
      if (!result.response.ok || !result.body.payload) throw new Error("forecast_request_failed");
      await upsertSnapshot(userId, "forecast", result.body.payload);
      await load();
    } catch {
      setError("Forecast refresh failed. Your last forecast is still available.");
      await load();
    } finally { setRefreshing(false); }
  }, [accessToken, horizon, level, load, userId]);

  const forecast = getForecastContent(snapshot);
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}><View>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}><ArrowLeft size={18} color="#1B1C1A" weight="bold" /><Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: "#6B7A6F" }}>Dashboard</Text></Pressable>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#08B16A", justifyContent: "center", alignItems: "center" }}><Sparkle size={18} color="#FFFFFF" weight="fill" /></View><View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Spending Forecast</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>Forecasts use your posted transaction history.</Text></View></View>
    {loading ? <ActivityIndicator color="#0B8A55" style={{ marginTop: 48 }} /> : <>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A", marginTop: 24 }}>Horizon</Text><View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>{HORIZONS.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: horizon === option.value }} onPress={() => setHorizon(option.value)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: horizon === option.value ? "#013220" : "#EFFEF7", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: horizon === option.value ? "#FFFFFF" : "#0B8A55" }}>{option.label}</Text></Pressable>)}</View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A", marginTop: 18 }}>Spending view</Text><View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>{LEVELS.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: level === option.value }} onPress={() => setLevel(option.value)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: level === option.value ? "#013220" : "#EFFEF7", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: level === option.value ? "#FFFFFF" : "#0B8A55" }}>{option.label}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh forecast" disabled={refreshing} onPress={refresh} style={{ marginTop: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: "#08B16A", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#FFFFFF" }}>{refreshing ? "Refreshing forecast..." : "Refresh forecast"}</Text></Pressable>
      {error ? <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 20, color: "#D9001F", marginTop: 14 }}>{error}</Text> : null}
      {forecast ? <ForecastLineChart forecast={forecast} /> : null}
      <ForecastPanel forecast={forecast} stale={snapshot?.stale ?? false} unavailable={!!error} onRefresh={refresh} onNavigate={onBack} />
    </>}
  </View></ScrollView>;
}

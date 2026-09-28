import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ArrowLeft, Sparkle } from "phosphor-react-native";
import { getSnapshot, upsertSnapshot } from "../../local-db/repositories/dashboardSnapshots";
import type { DashboardSnapshotWithMeta } from "../../local-db/repositories/dashboardSnapshots";
import { getForecastHistoryStartDate, listForecastTransactions } from "../../local-db/repositories/forecastTransactions";
import { getForecastContent } from "../dashboard/dashboardSnapshotContent";
import { ForecastPanel } from "../dashboard/components/ForecastPanel";
import { requestForecast } from "./api";
import { ForecastLineChart } from "./ForecastLineChart";

type Props = { userId: string; accessToken: string; onBack?: () => void; embedded?: boolean };

export default function SpendingForecastScreen({ userId, accessToken, onBack, embedded = false }: Props) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshotWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSnapshot(await getSnapshot(userId, "forecast")); } catch { setError("Forecast information is unavailable."); } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const historicalTransactions = await listForecastTransactions(userId, { fromDate: getForecastHistoryStartDate() });
      if (historicalTransactions.length === 0) {
        setError("Record a posted income or expense before requesting a forecast.");
        return;
      }
      const result = await requestForecast(accessToken, { historicalTransactions });
      if (!result.response.ok || !result.body.payload) throw new Error("forecast_request_failed");
      await upsertSnapshot(userId, "forecast", result.body.payload);
      await load();
    } catch {
      setError("Forecast update failed. Your last forecast is still available.");
      await load();
    }
  }, [accessToken, load, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const forecast = getForecastContent(snapshot);
  const content = <View>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back to financial reports" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}><ArrowLeft size={18} color="#1B1C1A" weight="bold" /><Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: "#6B7A6F" }}>Financial Reports</Text></Pressable> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#08B16A", justifyContent: "center", alignItems: "center" }}><Sparkle size={18} color="#FFFFFF" weight="fill" /></View><View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Monthly spending plan</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>Personalized from completed months and HFCE category trends.</Text></View></View>
    {loading ? <ActivityIndicator color="#0B8A55" style={{ marginTop: 48 }} /> : <>
      {error ? <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 20, color: "#D9001F", marginTop: 14 }}>{error}</Text> : null}
      {forecast ? <ForecastLineChart forecast={forecast} /> : null}
        <ForecastPanel forecast={forecast} stale={snapshot?.stale ?? false} unavailable={!!error} onRefresh={refresh} onNavigate={onBack} showRefresh={false} />
    </>}
  </View>;

  return embedded ? content : <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>{content}</ScrollView>;
}

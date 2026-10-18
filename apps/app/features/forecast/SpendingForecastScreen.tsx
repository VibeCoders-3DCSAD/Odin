import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ArrowLeft, Sparkle } from "phosphor-react-native";
import { getSnapshot, upsertSnapshot } from "../../local-db/repositories/dashboardSnapshots";
import type { DashboardSnapshotWithMeta } from "../../local-db/repositories/dashboardSnapshots";
import { getForecastHistoryStartDate, listForecastTransactions } from "../../local-db/repositories/forecastTransactions";
import { getQuarterlyForecastContent } from "../dashboard/dashboardSnapshotContent";
import { requestForecastInterpretation, requestQuarterlyForecast } from "./api";
import { forecastInterpretation, QuarterlyForecastCharts } from "./QuarterlyForecastCharts";

type Props = { userId: string; accessToken: string; onBack?: () => void; embedded?: boolean };

export default function SpendingForecastScreen({ userId, accessToken, onBack, embedded = false }: Props) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshotWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSnapshot(await getSnapshot(userId, "forecast_quarterly")); } catch { setError("Forecast information is unavailable."); } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      const historicalTransactions = await listForecastTransactions(userId, { fromDate: getForecastHistoryStartDate() });
      if (historicalTransactions.length === 0) {
        setError("Record a posted income or expense before requesting a forecast.");
        return;
      }
      const result = await requestQuarterlyForecast(accessToken, { historicalTransactions });
      if (result.response.ok && result.body.payload === null && result.body.reason) {
        setNotice(result.body.message ?? "A spending forecast isn't available yet.");
        return;
      }
      if (!result.response.ok || !result.body.payload) throw new Error("forecast_request_failed");
      const payload = result.body.payload;
      await upsertSnapshot(userId, "forecast_quarterly", payload);
      await load();
      const notes = forecastInterpretation(payload);
      if (notes.length === 0) return;
      // The charts already show the app's own notes; Groq's wording replaces them only if it arrives.
      const interpretation = await requestForecastInterpretation(accessToken, notes).catch(() => null);
      const rewritten = interpretation?.response.ok ? interpretation.body.payload?.notes : undefined;
      if (rewritten?.length === notes.length) {
        await upsertSnapshot(userId, "forecast_quarterly", { ...payload, interpretation: rewritten });
        await load();
      }
    } catch {
      setError("Forecast update failed. Your last forecast is still available.");
      await load();
    }
  }, [accessToken, load, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const forecast = getQuarterlyForecastContent(snapshot);
  const content = <View>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back to financial reports" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}><ArrowLeft size={18} color="#1B1C1A" weight="bold" /><Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: "#6B7A6F" }}>Financial Reports</Text></Pressable> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: "#08B16A", justifyContent: "center", alignItems: "center" }}><Sparkle size={18} color="#FFFFFF" weight="fill" /></View><View style={{ flex: 1, flexShrink: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Quarterly spending forecast</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>Your next 12 months, based on your past spending and seasonal spending in the Philippines.</Text></View></View>
    {loading ? <ActivityIndicator color="#0B8A55" style={{ marginTop: 48 }} /> : <>
      {error ? <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 20, color: "#D9001F", marginTop: 14 }}>{error}</Text> : null}
      {notice ? <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 20, color: "#6B7A6F", marginTop: 14 }}>{notice}</Text> : null}
      {snapshot?.stale && forecast ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 14 }}>Forecast data may be out of date.</Text> : null}
      {forecast ? <QuarterlyForecastCharts forecast={forecast} /> : !error && !notice ? <Text style={{ fontFamily: "Manrope", fontSize: 13, lineHeight: 20, color: "#6B7A6F", marginTop: 14 }}>Record posted transactions to unlock a spending forecast.</Text> : null}
    </>}
  </View>;

  return embedded ? content : <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>{content}</ScrollView>;
}

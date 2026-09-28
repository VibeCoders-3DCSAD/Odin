import { Pressable, Text, View } from "react-native";
import { Sparkle } from "phosphor-react-native";
import type { ForecastContent } from "../dashboardSnapshotContent";

type Props = { forecast: ForecastContent | null; stale?: boolean; unavailable?: boolean; refreshable?: boolean; onRefresh: () => void; onNavigate?: () => void; showRefresh?: boolean };

function formatPeso(centavos: number): string {
  return `PHP ${(centavos / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export function ForecastPanel({ forecast, stale, unavailable, refreshable, onRefresh, onNavigate, showRefresh = true }: Props) {
  const amount = forecast?.forecasts.reduce((sum, point) => sum + point.amountCentavos, 0) ?? null;
  const noForecastCopy = unavailable ? "Forecast information is unavailable. Refresh to try again." : "Record posted transactions to unlock a spending forecast.";
  return (
    <View style={{ marginTop: 20, padding: 20, borderRadius: 32, backgroundColor: "#EFFEF7" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#08B16A", justifyContent: "center", alignItems: "center" }}><Sparkle size={18} color="#FFFFFF" weight="fill" /></View>
        <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: "#1B1C1A" }}>Spending forecast</Text>
        {showRefresh && (stale || unavailable || refreshable) ? <Pressable accessibilityRole="button" accessibilityLabel="Refresh forecast" onPress={onRefresh}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#066B40" }}>Refresh</Text></Pressable> : null}
      </View>
        {forecast && amount !== null ? <View style={{ marginTop: 18 }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: "#414942" }}>{forecast.forecasts[0]?.month ?? "Next month"} spending plan</Text><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 24, color: "#013220", marginTop: 3 }}>{formatPeso(amount)}</Text></View> : null}
        <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942", marginTop: 14 }}>{forecast ? "Personalized from your completed-month spending and national HFCE trends." : noForecastCopy}</Text>
       {onNavigate ? <Pressable accessibilityRole="button" accessibilityLabel="View spending forecast" onPress={onNavigate} style={{ marginTop: 18 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#066B40" }}>View forecast details</Text></Pressable> : null}
    </View>
  );
}

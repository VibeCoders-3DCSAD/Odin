import { Pressable, Text, View } from "react-native";
import { Sparkle } from "phosphor-react-native";
import { dashboardColors as P, dashboardStyles } from "../dashboardAppearance";
import type { ForecastContent } from "../dashboardSnapshotContent";

type Props = { forecast: ForecastContent | null; stale?: boolean; unavailable?: boolean; refreshable?: boolean; onRefresh: () => void; onNavigate?: () => void; showRefresh?: boolean; emptyMessage?: string | null };

function formatPeso(centavos: number): string {
  return `PHP ${(centavos / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export function ForecastPanel({ forecast, stale, unavailable, refreshable, onRefresh, onNavigate, showRefresh = true, emptyMessage }: Props) {
  const amount = forecast?.forecasts.reduce((sum, point) => sum + point.amountCentavos, 0) ?? null;
  const noForecastCopy = emptyMessage ?? (unavailable ? "Forecast information is unavailable. Refresh to try again." : "Record posted transactions to unlock a spending forecast.");
  return (
    <View style={[dashboardStyles.card, { marginTop: 20, backgroundColor: P.mint }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: P.green, justifyContent: "center", alignItems: "center" }}><Sparkle size={18} color={P.surface} weight="fill" /></View>
        <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>Spending forecast</Text>
        {showRefresh && (stale || unavailable || refreshable) ? <Pressable accessibilityRole="button" accessibilityLabel="Refresh forecast" onPress={onRefresh}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.green }}>Refresh</Text></Pressable> : null}
      </View>
        {forecast && amount !== null ? <View style={{ marginTop: 18 }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: P.secondary }}>{forecast.forecasts[0]?.month ?? "Next month"} spending plan</Text><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 24, color: P.brand, marginTop: 3 }}>{formatPeso(amount)}</Text></View> : null}
        <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.secondary, marginTop: 14 }}>{forecast ? "Personalized from your completed-month spending and national HFCE trends." : noForecastCopy}</Text>
       {onNavigate ? <Pressable accessibilityRole="button" accessibilityLabel="View spending forecast" onPress={onNavigate} style={{ marginTop: 18 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.green }}>View forecast details</Text></Pressable> : null}
    </View>
  );
}

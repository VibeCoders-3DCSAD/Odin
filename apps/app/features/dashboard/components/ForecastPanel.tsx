import { Pressable, Text, View } from "react-native";
import { Sparkle } from "phosphor-react-native";
import type { ForecastContent } from "../dashboardSnapshotContent";
import type { ForecastHorizonResult } from "../../forecast/types";

type Props = { forecast: ForecastContent; horizon?: ForecastHorizonResult; stale?: boolean; unavailable?: boolean; refreshable?: boolean; onRefresh: () => void; onNavigate: () => void };

function formatPeso(centavos: number): string {
  return `PHP ${(centavos / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export function ForecastPanel({ forecast, horizon, stale, unavailable, refreshable, onRefresh, onNavigate }: Props) {
  const unavailableCopy = unavailable ? "Forecast information is unavailable. Refresh to try again." : "Forecast information is not yet available. Keep recording transactions to unlock personalized insights.";
  const largestCategory = Math.max(...forecast.categories.map((category) => category.amountCentavos), 1);
  const horizonIncome = horizon?.points.reduce((sum, point) => sum + point.income_centavos, 0) ?? null;
  const horizonExpense = horizon?.points.reduce((sum, point) => sum + point.expense_centavos, 0) ?? null;
  const projectedBalance = horizon?.points[horizon.points.length - 1]?.projected_balance_centavos ?? forecast.projectedBalanceCentavos;
  const period = horizon?.period ?? forecast.period;
  const text = horizon ? `${horizon.label} estimate for ${horizon.period}.` : forecast.text;
  return (
    <View style={{ marginTop: 20, padding: 20, borderRadius: 32, backgroundColor: "#EFFEF7" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#08B16A", justifyContent: "center", alignItems: "center" }}><Sparkle size={18} color="#FFFFFF" weight="fill" /></View>
        <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: "#1B1C1A" }}>{horizon ? `${horizon.label} spending forecast` : "Spending forecast"}</Text>
        {stale || unavailable || refreshable ? <Pressable accessibilityRole="button" accessibilityLabel="Refresh forecast" onPress={onRefresh}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#066B40" }}>Refresh</Text></Pressable> : null}
      </View>
      {projectedBalance !== null ? <View style={{ marginTop: 18 }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: "#414942" }}>Projected balance{period ? ` by ${period}` : ""}</Text><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 24, color: "#013220", marginTop: 3 }}>{formatPeso(projectedBalance)}</Text></View> : null}
      <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942", marginTop: 14 }}>{text ?? unavailableCopy}</Text>
      {horizonIncome !== null || horizonExpense !== null || forecast.incomeCentavos !== null || forecast.expenseCentavos !== null ? <View style={{ flexDirection: "row", gap: 16, marginTop: 18 }}><View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: "#414942" }}>Expected income</Text><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: "#066B40", marginTop: 3 }}>{(horizonIncome ?? forecast.incomeCentavos) === null ? "Not available" : formatPeso(horizonIncome ?? forecast.incomeCentavos!)}</Text></View><View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: "#414942" }}>Expected expenses</Text><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: "#1B1C1A", marginTop: 3 }}>{(horizonExpense ?? forecast.expenseCentavos) === null ? "Not available" : formatPeso(horizonExpense ?? forecast.expenseCentavos!)}</Text></View></View> : null}
      {forecast.categories.length > 0 ? <View style={{ marginTop: 18 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>Category forecast</Text>{forecast.categories.map((category) => <View key={category.label} style={{ marginTop: 10 }}><View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 14, color: "#414942" }}>{category.label}</Text><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>{formatPeso(category.amountCentavos)}</Text></View><View style={{ height: 6, borderRadius: 6, backgroundColor: "#D4F7E5", marginTop: 6 }}><View style={{ width: `${(category.amountCentavos / largestCategory) * 100}%`, height: 6, borderRadius: 6, backgroundColor: "#08B16A" }} /></View></View>)}</View> : null}
      {forecast.events.length > 0 ? <View style={{ marginTop: 18 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>Expected events</Text>{forecast.events.map((event) => <Text key={`${event.label}-${event.date}`} style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942", marginTop: 8 }}>• {event.label}{event.date ? ` · ${event.date}` : ""}</Text>)}</View> : null}
      {forecast.insights.map((insight) => <Text key={insight} style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942", marginTop: 8 }}>• {insight}</Text>)}
      {forecast.freshness || forecast.confidence ? <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942", marginTop: 18 }}>{[forecast.freshness, forecast.confidence].filter(Boolean).join(" · ")}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="View spending forecast" onPress={onNavigate} style={{ marginTop: 18 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#066B40" }}>View forecast details</Text></Pressable>
    </View>
  );
}

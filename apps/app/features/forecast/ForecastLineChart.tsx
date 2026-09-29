import { Text, View } from "react-native";
import type { ForecastPayload } from "./types";

function formatPeso(centavos: number): string {
  return `PHP ${(centavos / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function forecastCaption(point: ForecastPayload["forecasts"][number]): string {
  const category = point.category.replaceAll("_", " ");
  const difference = point.amountCentavos - point.userBaselineCentavos;

  if (difference > 0) return `Next month, ${category} may increase by ${formatPeso(difference)} from your usual monthly spending.`;
  if (difference < 0) return `Next month, ${category} may decrease by ${formatPeso(Math.abs(difference))} from your usual monthly spending.`;
  return `Next month, ${category} may stay close to your usual monthly spending.`;
}

export function ForecastLineChart({ forecast }: { forecast: ForecastPayload }) {
  return <View style={{ gap: 10, marginTop: 20 }}>{forecast.forecasts.map((point) => <View key={`${point.category}-${point.month}`} style={{ backgroundColor: "#EFFEF7", borderRadius: 16, padding: 14 }}>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><Text style={{ color: "#1B1C1A", flex: 1, fontFamily: "Manrope", fontSize: 14, fontWeight: "800" }}>{point.month} · {point.category.replaceAll("_", " ")}</Text><Text style={{ color: "#013220", fontFamily: "Manrope", fontSize: 15, fontWeight: "800" }}>{formatPeso(point.amountCentavos)}</Text></View>
    <Text style={{ color: "#6B7A6F", fontFamily: "Manrope", fontSize: 11, marginTop: 5 }}>{forecastCaption(point)}</Text>
  </View>)}</View>;
}

import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SavingsForecastPoint } from "./savingsForecast";

const P = { ink: "#1B1C1A", muted: "#6B7A6F", card: "#F1F0EB" } as const;
const LIMIT = 6;
const INITIAL_FORECAST_ROWS = 3;
const FORECAST_ROW_CHUNK = 8;
const money = (amount: number) => `PHP ${(amount / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SavingsForecastTable({ points, milestoneDate }: { points: SavingsForecastPoint[]; milestoneDate?: string | null }) {
  const [visibleForecastRows, setVisibleForecastRows] = useState(INITIAL_FORECAST_ROWS);
  const forecastPoints = points.filter((point) => point.isForecast);
  const rows = points.length <= LIMIT ? points : [points.filter((point) => !point.isForecast).at(-1), ...forecastPoints.slice(0, visibleForecastRows), milestoneDate ? points.find((point) => point.date === milestoneDate) : undefined].filter((point): point is SavingsForecastPoint => Boolean(point)).filter((point, index, values) => values.findIndex((value) => value.date === point.date && value.event === point.event) === index);
  const remainingForecastRows = Math.max(0, forecastPoints.length - visibleForecastRows);
  const nextForecastRowCount = points.length > LIMIT ? Math.min(FORECAST_ROW_CHUNK, remainingForecastRows) : 0;
  return <View style={{ marginTop: 14 }} accessibilityLabel="Savings balance details">
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 12, color: P.ink }}>Balance details</Text>
    {rows.map((point, index) => <View key={`${point.date}-${point.event}-${index}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: point.date === milestoneDate ? "#E8F5ED" : P.card }}><View style={{ minWidth: 56, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: point.isForecast ? "#E6EFFC" : "#E7E7E2" }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 9.5, color: point.isForecast ? "#2563EB" : P.muted }}>{point.isForecast ? "Forecast" : "Actual"}</Text></View><Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>{point.date === milestoneDate ? `Target reached · ${point.date}` : point.event === "interest_credit" ? `Interest credit · ${point.date}` : point.event === "scheduled_contribution" ? `Planned contribution · ${point.date}` : point.date}</Text><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5, color: P.ink }}>{money(point.balanceCentavos)}</Text></View>)}
    {nextForecastRowCount > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={`Show ${nextForecastRowCount} more forecast balance${nextForecastRowCount === 1 ? "" : "s"}`} onPress={() => setVisibleForecastRows((count) => count + FORECAST_ROW_CHUNK)} style={{ alignSelf: "flex-start", marginTop: 10 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5, color: "#066B40" }}>{`Show ${nextForecastRowCount} more`}</Text></Pressable> : null}
  </View>;
}

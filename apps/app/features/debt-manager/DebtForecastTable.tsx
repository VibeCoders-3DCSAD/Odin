import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ForecastChartPoint } from "./DebtForecastChart";

const P = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", card: "#F1F0EB" } as const;
const COMPACT_ROW_LIMIT = 6;

function formatPeso(amount: number): string {
  return `PHP ${(amount / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compactRows(points: ForecastChartPoint[], milestoneDate?: string): ForecastChartPoint[] {
  if (points.length <= COMPACT_ROW_LIMIT) return points;
  const current = points.filter((point) => !point.isForecast).at(-1);
  const upcoming = points.filter((point) => point.isForecast).slice(0, 3);
  const milestone = milestoneDate ? points.find((point) => point.date === milestoneDate) : undefined;
  return [current, ...upcoming, milestone].filter((point): point is ForecastChartPoint => Boolean(point)).filter((point, index, rows) => rows.findIndex((row) => row.id === point.id) === index);
}

type Props = { points: ForecastChartPoint[]; milestoneDate?: string };

export function DebtForecastTable({ points, milestoneDate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? points : compactRows(points, milestoneDate);
  const collapsible = points.length > COMPACT_ROW_LIMIT;

  return <View style={{ marginTop: 14 }} accessibilityLabel="Debt balance details">
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 12, color: P.ink }}>Balance details</Text>
    {rows.map((point) => {
      const milestone = point.date === milestoneDate;
      return <View key={point.id} accessibilityLabel={`${point.date}, ${point.isForecast ? "forecast" : "actual"} balance ${formatPeso(point.balanceCentavos)}${milestone ? ", debt-free milestone" : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: milestone ? "#E8F5ED" : P.card }}>
        <View style={{ minWidth: 56, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: point.isForecast ? "#E6EFFC" : "#E7E7E2" }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 9.5, color: point.isForecast ? "#2563EB" : P.muted }}>{point.isForecast ? "Forecast" : "Actual"}</Text></View>
        <Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>{milestone ? "Debt-free milestone" : point.date}</Text>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5, color: P.ink }}>{formatPeso(point.balanceCentavos)}</Text>
      </View>;
    })}
    {collapsible ? <Pressable accessibilityRole="button" accessibilityLabel={expanded ? "Show fewer forecast balances" : "See full forecast"} onPress={() => setExpanded((value) => !value)} style={{ alignSelf: "flex-start", marginTop: 10 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5, color: "#066B40" }}>{expanded ? "Show fewer balances" : `See full forecast (${points.length} points)`}</Text></Pressable> : null}
  </View>;
}

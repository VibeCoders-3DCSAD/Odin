import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { styles as ui, v4, v4Font } from "../../../../components/BudgieForm";
import type { ForecastChartPoint } from "./DebtForecastChart";
import { FLUSH_LIST } from "../../components/debtUi";
import { formatPhp } from "../../../../lib/format/money";

const COMPACT_ROW_LIMIT = 6;
const INITIAL_FORECAST_ROWS = 3;
const FORECAST_ROW_CHUNK = 8;

function compactRows(points: ForecastChartPoint[], forecastRowCount: number, milestoneDate?: string): ForecastChartPoint[] {
  if (points.length <= COMPACT_ROW_LIMIT) return points;
  const current = points.filter((point) => !point.isForecast).at(-1);
  const upcoming = points.filter((point) => point.isForecast).slice(0, forecastRowCount);
  const milestone = milestoneDate ? points.find((point) => point.date === milestoneDate) : undefined;
  return [current, ...upcoming, milestone].filter((point): point is ForecastChartPoint => Boolean(point)).filter((point, index, rows) => rows.findIndex((row) => row.id === point.id) === index);
}

type Props = { points: ForecastChartPoint[]; milestoneDate?: string; dateGranularity?: "day" | "month" };

export function DebtForecastTable({ points, milestoneDate, dateGranularity = "day" }: Props) {
  const [visibleForecastRows, setVisibleForecastRows] = useState(INITIAL_FORECAST_ROWS);
  const forecastPoints = points.filter((point) => point.isForecast);
  const rows = compactRows(points, visibleForecastRows, milestoneDate);
  const remainingForecastRows = Math.max(0, forecastPoints.length - visibleForecastRows);
  const nextForecastRowCount = points.length > COMPACT_ROW_LIMIT ? Math.min(FORECAST_ROW_CHUNK, remainingForecastRows) : 0;

  return <View accessibilityLabel="Debt balance details" style={{ gap: 8 }}>
    <Text style={{ fontFamily: v4Font, fontWeight: "800", fontSize: 12.5, color: v4.ink }}>Balance details</Text>
    <View style={FLUSH_LIST}>{rows.map((point, index) => {
      const milestone = point.date === milestoneDate;
      const dateLabel = dateGranularity === "month"
        ? new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00.000Z`))
        : point.date;
      return <View key={point.id} accessibilityLabel={`${point.date}, ${point.isForecast ? "forecast" : "actual"} balance ${formatPhp(point.balanceCentavos)}${milestone ? ", debt-free milestone" : ""}`} style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: milestone ? "#E9F6EF" : undefined }, index > 0 ? ui.listRowDivider : null]}>
        <View style={{ minWidth: 60, alignItems: "center", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: point.isForecast ? "#E6EFFC" : "#EFEBE3" }}><Text style={{ fontFamily: v4Font, fontWeight: "700", fontSize: 10, color: point.isForecast ? "#1D4ED8" : v4.ink2 }}>{point.isForecast ? "Forecast" : "Actual"}</Text></View>
        <Text style={{ flex: 1, fontFamily: v4Font, fontSize: 12, color: milestone ? "#004D1B" : v4.ink2, fontWeight: milestone ? "700" : "400" }}>{milestone ? `Debt-free milestone · ${dateLabel}` : dateLabel}</Text>
        <Text style={{ fontFamily: v4Font, fontWeight: "700", fontSize: 12.5, color: v4.ink, fontVariant: ["tabular-nums"] }}>{formatPhp(point.balanceCentavos)}</Text>
      </View>;
    })}</View>
    {nextForecastRowCount > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={`Show ${nextForecastRowCount} more forecast balance${nextForecastRowCount === 1 ? "" : "s"}`} onPress={() => setVisibleForecastRows((count) => count + FORECAST_ROW_CHUNK)} hitSlop={8} style={{ alignSelf: "flex-start" }}><Text style={{ fontFamily: v4Font, fontWeight: "700", fontSize: 12.5, color: v4.brand }}>{`Show ${nextForecastRowCount} more`}</Text></Pressable> : null}
  </View>;
}

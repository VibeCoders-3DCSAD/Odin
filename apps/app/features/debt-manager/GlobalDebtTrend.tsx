import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { filterDebtTrendPoints, type DebtTrendRange } from "./debtTrendRange";
import { LineChart } from "react-native-chart-kit/v2";

const CHART_HEIGHT = 280;

export type GlobalDebtPoint = { date: string; debtCentavos: number };

export default function GlobalDebtTrend({ points }: { points: GlobalDebtPoint[] }) {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<DebtTrendRange>("year");
  const payoffDate = points.find((point) => point.date >= new Date().toISOString().slice(0, 10) && point.debtCentavos <= 0)?.date;
  const visiblePoints = filterDebtTrendPoints(points, range, payoffDate);
  const yAxisMaximum = Math.max(1, ...visiblePoints.map((point) => point.debtCentavos / 100));
  if (points.length === 0) return null;
  return <View style={{ marginTop: 16, borderWidth: 1, borderColor: "#EAEAE6", borderRadius: 14, padding: 14, backgroundColor: "#fcf8f0" }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#1B1C1A" }}>Total debt trend</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: "#6B7A6F", marginTop: 3 }}>Credit-card debt is credit limit minus available credit. Other active debt balances are included.</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{(["month", "year", "payoff", "all"] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={option === "payoff" ? "Show today until debt free" : option === "all" ? "Show all debt history" : `Show 1 ${option}`} disabled={option === "payoff" && !payoffDate} onPress={() => setRange(option)} style={{ borderWidth: 1, borderColor: range === option ? "#1B1C1A" : "#EAEAE6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, opacity: option === "payoff" && !payoffDate ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: "#1B1C1A" }}>{option === "payoff" ? "Today to debt-free" : option === "all" ? "All" : `1 ${option}`}</Text></Pressable>)}</View>
    {payoffDate ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: "#1B1C1A", marginTop: 8 }}>Projected debt-free: {payoffDate}</Text> : null}
    <View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))} style={{ height: CHART_HEIGHT, marginTop: 10 }}>
      {width > 0 && visiblePoints.length > 0 ? <LineChart data={visiblePoints.map((point) => ({ date: point.date, debt: point.debtCentavos / 100 }))} xKey="date" series={[{ yKey: "debt", label: "Total debt", color: "#08B16A" }]} width={width} height={CHART_HEIGHT} yDomain={{ min: 0, max: yAxisMaximum, nice: false }} referenceLines={[{ y: yAxisMaximum, label: `PHP ${yAxisMaximum.toLocaleString("en-PH", { notation: "compact", maximumFractionDigits: 1 })}`, labelContainer: true, color: "#6B7A6F", opacity: 0.5 }]} formatXLabel={(value) => String(value).slice(5)} formatYLabel={(value) => `PHP ${Number(value).toLocaleString("en-PH", { notation: "compact", maximumFractionDigits: 1 })}`} yAxisLabelWidth="stable" showHorizontalGridLines labelStrategy="auto" edgeLabelPolicy="shift" dots={{ radius: 3, fill: "series" }} activeDot={{ radius: 5, fill: "background", stroke: "series" }} interaction={{ mode: "tap", selectionPersistence: "whileActive" }} tooltip={{ shared: true }} accessibilityLabel="Total debt over time" /> : null}
    </View>
  </View>;
}

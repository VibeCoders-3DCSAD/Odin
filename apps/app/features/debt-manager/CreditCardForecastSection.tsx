import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit/v2";
import type { CreditCardForecastPoint, CreditCardScheduleStatus } from "./creditCardForecast";
import { filterDebtTrendPoints, type DebtTrendRange } from "./debtTrendRange";

const P = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", card: "#F1F0EB" } as const;
const CHART_HEIGHT = 280;

function formatPeso(amount: number): string {
  return `PHP ${(amount / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CreditCardForecastSection({ points, status, creditLimitCentavos }: { points: CreditCardForecastPoint[]; status: CreditCardScheduleStatus; creditLimitCentavos: number }) {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<DebtTrendRange>("year");
  const payoffDate = points.find((point) => point.date >= new Date().toISOString().slice(0, 10) && creditLimitCentavos - point.availableCreditCentavos <= 0)?.date;
  const visiblePoints = filterDebtTrendPoints(points, range, payoffDate);
  const yAxisMaximum = Math.max(1, ...visiblePoints.map((point) => Math.max(0, creditLimitCentavos - point.availableCreditCentavos) / 100));
  const guidance = status === "ahead" ? "Recorded payments exceed the selected targets due so far." : status === "behind" ? "Recorded payments are below selected targets due so far." : "Recorded payments match selected targets due so far.";
  return <View style={{ borderTopWidth: 1, borderTopColor: P.line, marginTop: 18, paddingTop: 16 }} accessibilityLabel={`Repayment forecast: ${status.replace("_", " ")}. ${guidance}`}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>Credit-card debt trend</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 4 }}>{status === "on_schedule" ? "On Schedule" : status === "ahead" ? "Ahead" : "Behind"}. {guidance}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{(["month", "year", "payoff", "all"] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={option === "payoff" ? "Show today until debt free" : option === "all" ? "Show all debt history" : `Show 1 ${option}`} disabled={option === "payoff" && !payoffDate} onPress={() => setRange(option)} style={{ borderWidth: 1, borderColor: range === option ? P.ink : P.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, opacity: option === "payoff" && !payoffDate ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: P.ink }}>{option === "payoff" ? "Today to debt-free" : option === "all" ? "All" : `1 ${option}`}</Text></Pressable>)}</View>
    {payoffDate ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.ink, marginTop: 8 }}>Projected debt-free: {payoffDate}</Text> : null}
    {visiblePoints.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 10 }}>No card-debt movement falls in this calendar window.</Text> : <View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))} style={{ height: CHART_HEIGHT, marginTop: 10 }}>{width > 0 ? <LineChart data={visiblePoints.map((point) => ({ date: point.date, debt: Math.max(0, creditLimitCentavos - point.availableCreditCentavos) / 100 }))} xKey="date" series={[{ yKey: "debt", label: "Card debt", color: "#08B16A" }]} width={width} height={CHART_HEIGHT} yDomain={{ min: 0, max: yAxisMaximum, nice: false }} formatXLabel={(value) => String(value).slice(5)} formatYLabel={(value) => `PHP ${Number(value).toLocaleString("en-PH", { notation: "compact", maximumFractionDigits: 1 })}`} yAxisLabelWidth="stable" showHorizontalGridLines labelStrategy="auto" edgeLabelPolicy="shift" dots={{ radius: 3, fill: "series" }} activeDot={{ radius: 5, fill: "background", stroke: "series" }} interaction={{ mode: "tap", selectionPersistence: "whileActive" }} tooltip={{ shared: true }} accessibilityLabel="Credit-card debt over time" /> : null}</View>}
    {visiblePoints.map((point) => <View key={point.cycleId} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: P.card }}>
      <Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>{point.date}</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5, color: P.ink }}>{formatPeso(Math.max(0, creditLimitCentavos - point.availableCreditCentavos))}</Text>
    </View>)}
    <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 8 }}>Each point is credit limit minus available credit. History is reconstructed from recorded card purchases and payments.</Text>
  </View>;
}

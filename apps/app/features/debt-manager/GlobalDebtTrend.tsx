import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { filterDebtTrendPoints, getPhilippineToday, type DebtTrendRange } from "./debtTrendRange";
import { DebtForecastChart } from "./DebtForecastChart";
import { DebtForecastTable } from "./DebtForecastTable";

const CHART_HEIGHT = 220;

export type GlobalDebtPoint = { date: string; debtCentavos: number };

function formatMilestoneDate(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

export default function GlobalDebtTrend({ points }: { points: GlobalDebtPoint[] }) {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<DebtTrendRange>("year");
  const today = getPhilippineToday();
  const payoffDate = points.find((point) => point.date >= today && point.debtCentavos <= 0)?.date;
  const visiblePoints = filterDebtTrendPoints(points, range, payoffDate);
  const balancePoints = visiblePoints.map((point, index) => ({ id: `${point.date}-${index}`, date: point.date, balanceCentavos: point.debtCentavos, isForecast: point.date > today }));
  if (points.length === 0) return null;
  return <View style={{ marginTop: 16, borderWidth: 1, borderColor: "#EAEAE6", borderRadius: 14, padding: 14, backgroundColor: "#fcf8f0" }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#1B1C1A" }}>Total debt trend</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: "#6B7A6F", marginTop: 3 }}>Credit-card debt is credit limit minus available credit. Other active debt balances are included.</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{(["month", "year", "payoff", "all"] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={option === "payoff" ? "Show today until debt free" : option === "all" ? "Show all debt history" : `Show 1 ${option}`} disabled={option === "payoff" && !payoffDate} onPress={() => setRange(option)} style={{ borderWidth: 1, borderColor: range === option ? "#1B1C1A" : "#EAEAE6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, opacity: option === "payoff" && !payoffDate ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: "#1B1C1A" }}>{option === "payoff" ? "Today to debt-free" : option === "all" ? "All" : `1 ${option}`}</Text></Pressable>)}</View>
    {payoffDate ? <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#E8F5ED" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 12, color: "#087443" }}>Debt-free by {formatMilestoneDate(payoffDate)}</Text><Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: "#6B7A6F", marginTop: 2 }}>Based on all current repayment projections.</Text></View> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }} accessibilityLabel="Chart legend: solid line actual balance, dashed line forecast">
      <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: "#6B7A6F" }}>Solid: Actual balance</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: "#6B7A6F" }}>Dashed: Forecast</Text>
    </View>
    <View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))} style={{ height: CHART_HEIGHT, marginTop: 10 }}>
      {width > 0 && visiblePoints.length > 0 ? <DebtForecastChart points={balancePoints} status="on_schedule" today={today} width={width} colorMode="blue" /> : null}
    </View>
    {visiblePoints.length > 0 ? <DebtForecastTable points={balancePoints} milestoneDate={payoffDate} /> : null}
  </View>;
}

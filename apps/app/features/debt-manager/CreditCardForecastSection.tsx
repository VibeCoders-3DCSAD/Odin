import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { CreditCardForecastPoint, CreditCardScheduleStatus } from "./creditCardForecast";
import { DebtForecastChart } from "./DebtForecastChart";
import { DebtForecastTable } from "./DebtForecastTable";
import { filterDebtTrendPoints, getPhilippineToday, type DebtTrendRange } from "./debtTrendRange";

const P = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;
const CHART_HEIGHT = 220;

function collapseSameDayActuals<T extends { date: string; isForecast: boolean }>(points: T[]): T[] {
  const lastActualIndexByDate = new Map<string, number>();
  points.forEach((point, index) => {
    if (!point.isForecast) lastActualIndexByDate.set(point.date, index);
  });
  return points.filter((point, index) => point.isForecast || lastActualIndexByDate.get(point.date) === index);
}

function formatMilestoneDate(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

type Props = {
  forecast: { points: CreditCardForecastPoint[]; status: CreditCardScheduleStatus } | null;
  isLoading: boolean;
  creditLimitCentavos: number;
  reconciliationAt?: string | null;
};

export default function CreditCardForecastSection({ forecast, isLoading, creditLimitCentavos, reconciliationAt }: Props) {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<DebtTrendRange>("year");
  const rangeCache = useRef<{
    points: CreditCardForecastPoint[];
    today: string;
    payoffDate: string | undefined;
    visiblePoints: Map<DebtTrendRange, CreditCardForecastPoint[]>;
  } | null>(null);
  if (!forecast) {
    return <View accessibilityLabel="Generating credit-card repayment forecast" style={{ borderTopWidth: 1, borderTopColor: P.line, marginTop: 18, paddingTop: 16, alignItems: "center" }}>
      <ActivityIndicator color="#013220" />
      <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 8 }}>Generating your repayment forecast...</Text>
    </View>;
  }
  const { points, status } = forecast;
  const today = getPhilippineToday();
  if (rangeCache.current?.points !== points || rangeCache.current.today !== today) {
    rangeCache.current = {
      points,
      today,
      payoffDate: points.find((point) => point.date >= today && creditLimitCentavos - point.availableCreditCentavos <= 0)?.date,
      visiblePoints: new Map(),
    };
  }
  const { payoffDate, visiblePoints: cachedRanges } = rangeCache.current;
  const visiblePoints = cachedRanges.get(range) ?? filterDebtTrendPoints(points, range, payoffDate);
  if (!cachedRanges.has(range)) cachedRanges.set(range, visiblePoints);
  const balancePoints = collapseSameDayActuals(visiblePoints.map((point) => ({ id: `${point.cycleId}-${point.date}`, date: point.date, balanceCentavos: Math.max(0, creditLimitCentavos - point.availableCreditCentavos), isForecast: point.cycleId.startsWith("forecast") })));
  const guidance = status === "ahead" ? "Recorded payments exceed the selected targets due so far." : status === "behind" ? "Recorded payments are below selected targets due so far." : "Recorded payments match selected targets due so far.";
  return <View style={{ borderTopWidth: 1, borderTopColor: P.line, marginTop: 18, paddingTop: 16 }} accessibilityLabel={`Repayment forecast: ${status.replace("_", " ")}. ${guidance}`}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>Credit-card debt trend</Text>
    {reconciliationAt ? <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 4 }}>Issuer balance anchored {new Date(reconciliationAt).toLocaleString()}. Earlier history is estimated from recorded activity.</Text> : null}
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 4 }}>{status === "on_schedule" ? "On Schedule" : status === "ahead" ? "Ahead" : "Behind"}. {guidance}</Text>
    {isLoading ? <View accessibilityLabel="Updating credit-card repayment forecast" style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}><ActivityIndicator size="small" color="#013220" /><Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted }}>Updating forecast...</Text></View> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{(["month", "year", "payoff", "all"] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={option === "payoff" ? "Show today until debt free" : option === "all" ? "Show all debt history" : `Show 1 ${option}`} disabled={option === "payoff" && !payoffDate} onPress={() => setRange(option)} style={{ borderWidth: 1, borderColor: range === option ? P.ink : P.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, opacity: option === "payoff" && !payoffDate ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: P.ink }}>{option === "payoff" ? "Today to debt-free" : option === "all" ? "All" : `1 ${option}`}</Text></Pressable>)}</View>
    {payoffDate ? <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#E8F5ED" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 12, color: "#087443" }}>Debt-free by {formatMilestoneDate(payoffDate)}</Text><Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 2 }}>Based on your selected repayment strategy.</Text></View> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }} accessibilityLabel="Chart legend: solid line actual balance, dashed line forecast">
      <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted }}>Solid: Actual balance</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted }}>Dashed: Forecast</Text>
    </View>
    {visiblePoints.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 10 }}>No card-debt movement falls in this calendar window.</Text> : <><View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))} style={{ height: CHART_HEIGHT, marginTop: 10 }}>{width > 0 ? <DebtForecastChart points={balancePoints} status={status} today={today} width={width} colorMode="blue" /> : null}</View><DebtForecastTable points={balancePoints} milestoneDate={payoffDate} /></>}
    <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 8 }}>Each point is credit limit minus available credit. {reconciliationAt ? "Points before the issuer anchor are estimated history." : "History is reconstructed from recorded card purchases and payments."}</Text>
  </View>;
}

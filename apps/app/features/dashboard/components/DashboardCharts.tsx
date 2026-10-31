import { Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import type { DailyTrend } from "../../../local-db/repositories/dashboard/dashboardSummary";

type TrendColors = { line: string; income: string; expense: string; muted: string };

export function SpendingPie({ segments, total, totalLabel, line, muted }: { segments: { label: string; value: number; color: string }[]; total: number; totalLabel: string; line: string; muted: string }) {
  if (total <= 0) return <View accessible accessibilityLabel="Spending chart unavailable because no expenses were recorded this month" style={{ width: 88, height: 88, justifyContent: "center", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: muted, textAlign: "center" }}>No spending data</Text></View>;
  const size = 88;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <View accessible accessibilityLabel={`Spending total ${totalLabel} across ${segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ")}`} style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}><Svg accessible={false} width={size} height={size} viewBox={`0 0 ${size} ${size}`}><Circle cx={size / 2} cy={size / 2} r={radius} stroke={line} strokeWidth={strokeWidth} fill="none" />{segments.map((segment) => { const length = (segment.value / total) * circumference; const circle = <Circle key={segment.label} cx={size / 2} cy={size / 2} r={radius} stroke={segment.color} strokeWidth={strokeWidth} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt" fill="none" rotation="-90" origin={`${size / 2}, ${size / 2}`} />; offset += length; return circle; })}</Svg><View style={{ position: "absolute", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: "#1B1C1A" }}>{totalLabel}</Text><Text style={{ fontFamily: "Manrope", fontSize: 10, color: muted, marginTop: 1 }}>Total</Text></View></View>;
}

const chartWidth = 290;
const chartHeight = 90;

function LineGraph({ points, color }: { points: { x: number; y: number }[]; color: string }) {
  return <>
    <Polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    {points.map((point, index) => <Circle key={`dot-${index}`} cx={point.x} cy={point.y} r={3} fill={color} />)}
  </>;
}

export function TrendChart({ data, startingBalance, colors }: { data: DailyTrend[]; startingBalance: number | null; colors: TrendColors }) {
  if (data.length === 0) return <View accessible accessibilityLabel="Trend chart unavailable because there is no activity this month" style={{ height: chartHeight + 10, justifyContent: "center", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: colors.muted }}>No data this month</Text></View>;
  const balances = startingBalance === null ? [] : data.map((day) => startingBalance + day.balance_centavos);
  const expenses = data.map((day) => day.expense_centavos);
  const maximum = Math.max(...balances, ...expenses, 1);
  const minimum = Math.min(...balances, ...expenses, 0);
  const range = maximum - minimum || 1;
  const point = (values: number[]) => values.map((value, index) => ({ x: 8 + (data.length === 1 ? 137 : (index / (data.length - 1)) * 274), y: 6 + 78 - ((value - minimum) / range) * 78 }));
  return <View accessible accessibilityLabel={`Trend chart with ${data.length} days of activity`} style={{ width: "100%", height: chartHeight + 10 }}><Svg accessible={false} width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}><LineGraph points={point(expenses)} color={colors.expense} />{balances.length > 0 ? <LineGraph points={point(balances)} color={colors.income} /> : null}</Svg></View>;
}

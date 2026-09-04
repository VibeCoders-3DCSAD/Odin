import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { DailyTrend } from "../../../local-db/repositories/dashboardSummary";

type TrendColors = { line: string; income: string; expense: string; muted: string };

export function SpendingPie({ segments, total, totalLabel, line, muted }: { segments: { label: string; value: number; color: string }[]; total: number; totalLabel: string; line: string; muted: string }) {
  if (total <= 0) return <View accessible accessibilityLabel="Spending chart unavailable because no expenses were recorded this month" style={{ width: 104, height: 104, justifyContent: "center", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: muted, textAlign: "center" }}>No spending data</Text></View>;
  const size = 104;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <View accessible accessibilityLabel={`Spending total ${totalLabel} across ${segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ")}`} style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}><Svg accessible={false} width={size} height={size} viewBox={`0 0 ${size} ${size}`}><Circle cx={size / 2} cy={size / 2} r={radius} stroke={line} strokeWidth={strokeWidth} fill="none" />{segments.map((segment) => { const length = (segment.value / total) * circumference; const circle = <Circle key={segment.label} cx={size / 2} cy={size / 2} r={radius} stroke={segment.color} strokeWidth={strokeWidth} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt" fill="none" rotation="-90" origin={`${size / 2}, ${size / 2}`} />; offset += length; return circle; })}</Svg><View style={{ position: "absolute", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: "#1B1C1A" }}>{totalLabel}</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: muted, marginTop: 1 }}>Total</Text></View></View>;
}

const chartWidth = 290;
const chartHeight = 90;

function LineGraph({ points, color }: { points: { x: number; y: number }[]; color: string }) {
  return <>{points.map((point, index) => { if (index === 0) return null; const previous = points[index - 1]!; const length = Math.hypot(point.x - previous.x, point.y - previous.y); return <View key={`line-${index}`} style={{ position: "absolute", left: (previous.x + point.x - length) / 2, top: (previous.y + point.y) / 2 - 1, width: length, height: 2, borderRadius: 1, backgroundColor: color, transform: [{ rotate: `${Math.atan2(point.y - previous.y, point.x - previous.x) * (180 / Math.PI)}deg` }] }} />; })}{points.map((point, index) => <View key={`dot-${index}`} style={{ position: "absolute", left: point.x - 3, top: point.y - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />)}</>;
}

export function TrendChart({ data, startingBalance, colors }: { data: DailyTrend[]; startingBalance: number | null; colors: TrendColors }) {
  if (data.length === 0) return <View accessible accessibilityLabel="Trend chart unavailable because there is no activity this month" style={{ height: chartHeight + 10, justifyContent: "center", alignItems: "center" }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: colors.muted }}>No data this month</Text></View>;
  const balances = startingBalance === null ? [] : data.map((day) => startingBalance + day.balance_centavos);
  const expenses = data.map((day) => day.expense_centavos);
  const maximum = Math.max(...balances, ...expenses, 1);
  const minimum = Math.min(...balances, ...expenses, 0);
  const range = maximum - minimum || 1;
  const point = (values: number[]) => values.map((value, index) => ({ x: 8 + (data.length === 1 ? 137 : (index / (data.length - 1)) * 274), y: 6 + 78 - ((value - minimum) / range) * 78 }));
  return <View accessible accessibilityLabel={`Trend chart with ${data.length} days of activity`} style={{ width: "100%", height: chartHeight + 10 }}><View style={{ width: "100%", height: chartHeight, position: "relative" }}><LineGraph points={point(expenses)} color={colors.expense} />{balances.length > 0 ? <LineGraph points={point(balances)} color={colors.income} /> : null}</View></View>;
}

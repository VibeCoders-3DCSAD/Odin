import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import type { ForecastHorizonResult } from "./types";

const WIDTH = 320;
const HEIGHT = 150;
const PADDING = 16;

function pointsFor(values: number[], minimum: number, range: number): string {
  return values.map((value, index) => {
    const x = PADDING + (index / Math.max(values.length - 1, 1)) * (WIDTH - PADDING * 2);
    const y = PADDING + (1 - (value - minimum) / range) * (HEIGHT - PADDING * 2);
    return `${x},${y}`;
  }).join(" ");
}

export function ForecastLineChart({ horizon }: { horizon: ForecastHorizonResult }) {
  const balances = horizon.points.map((point) => point.projected_balance_centavos);
  const expenses = horizon.points.map((point) => point.expense_centavos);
  const minimum = Math.min(...balances, ...expenses, 0);
  const maximum = Math.max(...balances, ...expenses, 1);
  const range = maximum - minimum || 1;
  const balancePoints = pointsFor(balances, minimum, range);
  const expensePoints = pointsFor(expenses, minimum, range);

  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>Forecast trend</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>{horizon.period}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#08B16A" }} /><Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F" }}>Balance</Text></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#C25E00" }} /><Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F" }}>Expenses</Text></View>
        </View>
      </View>
      <View accessible accessibilityLabel={`${horizon.label} forecast line graph with ${horizon.points.length} points`} style={{ marginTop: 10, alignItems: "center" }}>
        <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <Line x1={PADDING} x2={WIDTH - PADDING} y1={HEIGHT - PADDING} y2={HEIGHT - PADDING} stroke="#EAEAE6" strokeWidth="1" />
          <Polyline points={expensePoints} fill="none" stroke="#C25E00" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <Polyline points={balancePoints} fill="none" stroke="#08B16A" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {balances.map((value, index) => {
            const x = PADDING + (index / Math.max(balances.length - 1, 1)) * (WIDTH - PADDING * 2);
            const y = PADDING + (1 - (value - minimum) / range) * (HEIGHT - PADDING * 2);
            return <Circle key={`${horizon.key}-${index}`} cx={x} cy={y} r="3" fill="#08B16A" />;
          })}
        </Svg>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: PADDING }}>
        {horizon.points.map((point) => <Text key={`${horizon.key}-${point.label}`} style={{ fontFamily: "Manrope", fontSize: 10, color: "#6B7A6F" }}>{point.label}</Text>)}
      </View>
    </View>
  );
}

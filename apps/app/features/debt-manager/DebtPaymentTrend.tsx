import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { DebtPaymentTrendPoint } from "./debtManagerSummary";

const P = { shell: "#fcf8f0", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", brand: "#013220" } as const;

function formatPeso(amountCentavos: number): string {
  return `PHP ${(amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DebtPaymentTrend({ points }: { points: DebtPaymentTrendPoint[] }) {
  const [visibleCount, setVisibleCount] = useState(5);
  const recentPoints = points.slice().reverse().slice(0, visibleCount);
  const hasMore = points.length > recentPoints.length;
  return <View accessibilityLabel="Recorded debt payment trend" style={{ marginTop: 16, borderWidth: 1, borderColor: P.line, borderRadius: 14, padding: 14, backgroundColor: P.shell }}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", color: P.ink }}>Payment trend</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 3 }}>Recorded debt and statement payments</Text>
    {recentPoints.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 12 }}>No debt payments have been recorded yet.</Text> : <><View style={{ flexDirection: "row", gap: 10, marginTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: P.line }}><Text style={{ width: 82, fontFamily: "Manrope", fontWeight: "800", fontSize: 10.5, color: P.muted }}>Date</Text><Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "800", fontSize: 10.5, color: P.muted }}>Debt</Text><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 10.5, color: P.muted }}>Payment made</Text></View>{recentPoints.map((point, index) => <View key={`${point.date}-${point.debtName}-${index}`} accessibilityLabel={`${point.date}, ${point.debtName}, payment made ${formatPeso(point.amountCentavos)}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
      <Text style={{ width: 82, fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>{point.date}</Text>
      <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, fontFamily: "Manrope", fontSize: 11.5, color: P.ink }}>{point.debtName}</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 11.5, color: P.brand }}>{formatPeso(point.amountCentavos)}</Text>
    </View>)}{hasMore ? <Pressable accessibilityRole="button" accessibilityLabel="Show 5 more payments" onPress={() => setVisibleCount((count) => count + 5)} style={{ alignSelf: "flex-start", marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 11.5, color: P.brand }}>Show 5 more payments</Text></Pressable> : null}</>}
  </View>;
}

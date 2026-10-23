import { StyleSheet, Text, View } from "react-native";
import { TrendUp } from "phosphor-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

type Props = {
  label?: string;
  amount: string;
  detail?: string;
  detailPill?: boolean;
  marginBottom?: number;
  variant?: "default" | "compact";
};

export default function AvailableBalanceCard({ label = "Available Balance", amount, detail, detailPill = false, marginBottom = 0, variant = "default" }: Props) {
  const compact = variant === "compact";
  return (
    <View style={{ minHeight: compact ? 120 : 161, borderRadius: compact ? 16 : 24, backgroundColor: "#013220", padding: compact ? 18 : 24, position: "relative", overflow: "hidden", marginBottom }}>
      {compact ? (
        <Svg accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs><LinearGradient id="balanceGradient" x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0%" stopColor="#013220" /><Stop offset="100%" stopColor="#004D1B" /></LinearGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#balanceGradient)" />
        </Svg>
      ) : <View style={{ position: "absolute", right: -26, top: -26, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(65, 237, 164, 0.13)" }} />}
      <Text style={{ fontFamily: "Manrope", fontWeight: compact ? "600" : "500", fontSize: compact ? 11.5 : 13, textTransform: compact ? "uppercase" : "none", letterSpacing: compact ? 0.46 : 0, color: compact ? "#FFFFFF" : "rgba(255,255,255,0.72)" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: compact ? "wrap" : "nowrap", alignItems: "baseline", marginTop: 7 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: compact ? 13 : 18, color: compact ? "#FFFFFF" : "rgba(255,255,255,0.7)", marginRight: 4 }}>PHP</Text>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: compact ? 30 : 34, color: "#FFFFFF", letterSpacing: -0.5, flexShrink: compact ? 1 : 0 }}>{amount}</Text>
      </View>
      {detail && detailPill ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: compact ? 10 : 14, paddingVertical: compact ? 4 : 6, paddingHorizontal: compact ? 10 : 11, borderRadius: 100, backgroundColor: compact ? "#013220" : "rgba(255,255,255,0.13)", alignSelf: "flex-start" }}>
          <TrendUp size={14} color={compact ? "#FFFFFF" : "#7cf9c4"} weight="bold" />
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: compact ? 11 : 12, color: "#FFFFFF", flexShrink: compact ? 1 : 0 }}>{detail}</Text>
        </View>
      ) : detail ? (
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#FFFFFF", marginTop: 14 }}>{detail}</Text>
      ) : null}
    </View>
  );
}

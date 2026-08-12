import { Text, View } from "react-native";
import { TrendUp } from "phosphor-react-native";

type Props = {
  label?: string;
  amount: string;
  detail?: string;
  detailPill?: boolean;
  marginBottom?: number;
};

export default function AvailableBalanceCard({ label = "Available Balance", amount, detail, detailPill = false, marginBottom = 0 }: Props) {
  return (
    <View style={{ minHeight: 161, borderRadius: 24, backgroundColor: "#013220", padding: 24, position: "relative", overflow: "hidden", marginBottom }}>
      <View style={{ position: "absolute", right: -26, top: -26, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(65, 237, 164, 0.13)" }} />
      <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 7 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 18, color: "rgba(255,255,255,0.7)", marginRight: 4 }}>PHP</Text>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 34, color: "#FFFFFF", letterSpacing: -0.5 }}>{amount}</Text>
      </View>
      {detail && detailPill ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.13)", alignSelf: "flex-start" }}>
          <TrendUp size={14} color="#7cf9c4" weight="bold" />
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#FFFFFF" }}>{detail}</Text>
        </View>
      ) : detail ? (
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#FFFFFF", marginTop: 14 }}>{detail}</Text>
      ) : null}
    </View>
  );
}

import { Text, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "phosphor-react-native";
import { dashboardColors as P } from "../../../dashboard/dashboardAppearance";
import { sectionLabel } from "../constants";
import { formatAmount } from "../helpers/historyFormat";

export function StatCard({ kind, centavos }: { kind: "income" | "expense"; centavos: number }) {
  const income = kind === "income";
  return (
    <View style={{ flex: 1, borderRadius: 12, padding: 14, backgroundColor: income ? P.mint : P.pink }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: income ? P.green : P.expenseIcon, alignItems: "center", justifyContent: "center" }}>
          {income ? <ArrowUpRight size={13} color="#fff" weight="bold" /> : <ArrowDownLeft size={13} color="#fff" weight="bold" />}
        </View>
        <Text style={sectionLabel}>{income ? "INCOME" : "EXPENSES"}</Text>
      </View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 19, letterSpacing: -0.2, color: P.ink, fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
        <Text style={{ fontWeight: "600", fontSize: 11, color: P.secondary }}>₱</Text>
        {formatAmount(centavos)}
      </Text>
    </View>
  );
}

import React from "react";
import { Text, View } from "react-native";
import type { DebtStrategy } from "../../local-db/repositories/debtRepaymentPlans";

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", white: "#FFFFFF" } as const;
const php = (centavos: number) => `PHP ${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export type DebtPlanRow = { id: string; label: string; amountCentavos: number; dueDate?: string | null };

type Props = {
  strategy: DebtStrategy;
  hasPlan: boolean;
  budgetRemainingCentavos: number | null;
  creditCardRequirementCentavos: number;
  requiredPaymentCentavos: number;
  shortfallCentavos: number;
  surplusCentavos: number;
  repayments: DebtPlanRow[];
  surplusRecommendations: DebtPlanRow[];
};

export default function DebtRepaymentPlanCard({ strategy, hasPlan, budgetRemainingCentavos, creditCardRequirementCentavos, requiredPaymentCentavos, shortfallCentavos, surplusCentavos, repayments, surplusRecommendations }: Props) {
  const overBudget = budgetRemainingCentavos !== null && budgetRemainingCentavos < 0;
  const hasShortfall = shortfallCentavos > 0;
  return <View style={{ gap: 10, marginTop: 14 }}>
    <Text accessibilityRole="header" style={{ color: P.ink, fontFamily: "Manrope", fontSize: 16, fontWeight: "800" }}>{strategy === "snowball" ? "Snowball" : "Avalanche"} repayment plan</Text>
    {hasPlan ? <>
      <View style={{ backgroundColor: P.brand, borderRadius: 16, padding: 16 }}>
        <Text style={{ color: "#D7EEE2", fontFamily: "Manrope", fontSize: 12 }}>Budget remaining this month</Text>
        <Text accessibilityRole={overBudget ? "alert" : undefined} style={{ color: overBudget ? "#FFB4AB" : P.white, fontFamily: "Manrope", fontSize: 25, fontWeight: "800", marginTop: 2 }}>{budgetRemainingCentavos === null ? "Unavailable" : php(budgetRemainingCentavos)}</Text>
        <Text style={{ color: "#D7EEE2", fontFamily: "Manrope", fontSize: 11.5, marginTop: 4 }}>From your Financial Plan, after recorded spending.</Text>
        <View style={{ borderTopColor: "#416153", borderTopWidth: 1, flexDirection: "row", gap: 8, marginTop: 14, paddingTop: 12 }}>
          <Stat label="Card statement targets" value={php(creditCardRequirementCentavos)} />
          <Stat label="Required loan payments" value={php(requiredPaymentCentavos)} />
          <Stat label={hasShortfall ? "Plan shortfall" : "Strategy surplus"} value={php(hasShortfall ? shortfallCentavos : surplusCentavos)} alert={hasShortfall} />
        </View>
      </View>
      {repayments.length ? <RowList title="Financial Plan repayments" rows={repayments} /> : null}
      {surplusRecommendations.length ? <RowList title="Recommended surplus allocation" rows={surplusRecommendations} /> : null}
    </> : <View style={{ backgroundColor: P.shell, borderColor: P.line, borderRadius: 14, borderWidth: 1, padding: 14 }}><Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 12 }}>Accept a Financial Plan for this month to calculate allocation and surplus.</Text></View>}
  </View>;
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return <View style={{ flex: 1 }}><Text style={{ color: "#9FC2B0", fontFamily: "Manrope", fontSize: 11 }}>{label}</Text><Text accessibilityRole={alert ? "alert" : undefined} style={{ color: alert ? "#FFB4AB" : P.white, fontFamily: "Manrope", fontSize: 13, fontWeight: "800", marginTop: 2 }}>{value}</Text></View>;
}

function RowList({ title, rows }: { title: string; rows: DebtPlanRow[] }) {
  return <View style={{ backgroundColor: P.shell, borderColor: P.line, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 }}>
    <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "800", paddingVertical: 8 }}>{title}</Text>
    {rows.map((row) => <View key={row.id} accessible accessibilityLabel={`${row.label}, ${php(row.amountCentavos)}${row.dueDate ? `, due ${row.dueDate}` : ""}`} style={{ alignItems: "center", borderTopColor: P.line, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}><Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "700" }}>{row.label}</Text>{row.dueDate ? <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11, marginTop: 2 }}>Due {row.dueDate}</Text> : null}</View>
      <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>{php(row.amountCentavos)}</Text>
    </View>)}
  </View>;
}

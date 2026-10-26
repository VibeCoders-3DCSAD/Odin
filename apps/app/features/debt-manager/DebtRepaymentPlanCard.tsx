import React from "react";
import { Text, View } from "react-native";
import { FormCard, Note, v4, v4Font } from "../../components/BudgieForm";
import type { DebtStrategy } from "../../local-db/repositories/debtRepaymentPlans";
import { Divider, InfoRow, formatPeso as php } from "./debtUi";

export type DebtPlanRow = { id: string; label: string; amountCentavos: number; dueDate?: string | null };

type Props = {
  strategy: DebtStrategy;
  hasPlan: boolean;
  debtBudgetCentavos: number;
  creditCardRequirementCentavos: number;
  requiredPaymentCentavos: number;
  shortfallCentavos: number;
  surplusCentavos: number;
  repayments: DebtPlanRow[];
  surplusRecommendations: DebtPlanRow[];
};

export default function DebtRepaymentPlanCard({ strategy, hasPlan, debtBudgetCentavos, creditCardRequirementCentavos, requiredPaymentCentavos, shortfallCentavos, surplusCentavos, repayments, surplusRecommendations }: Props) {
  const hasShortfall = shortfallCentavos > 0;
  return <FormCard title={`${strategy === "snowball" ? "Snowball" : "Avalanche"} repayment plan`}>
    {hasPlan ? <>
      <View>
        <Text style={{ color: v4.ink2, fontFamily: v4Font, fontSize: 12 }}>Debt budget this month</Text>
        <Text style={{ color: v4.ink, fontFamily: v4Font, fontSize: 22, fontWeight: "800", marginTop: 2, fontVariant: ["tabular-nums"] }}>{php(debtBudgetCentavos)}</Text>
        <Note>From your Financial Plan: debt repayments plus debt surplus.</Note>
      </View>
      <Divider />
      <InfoRow label="Card statement targets" value={php(creditCardRequirementCentavos)} />
      <InfoRow label="Required loan payments" value={php(requiredPaymentCentavos)} />
      <View accessibilityRole={hasShortfall ? "alert" : undefined}><InfoRow label={hasShortfall ? "Plan shortfall" : "Strategy surplus"} value={php(hasShortfall ? shortfallCentavos : surplusCentavos)} tone={hasShortfall ? "err" : "ok"} /></View>
      {repayments.length ? <RowList title="Financial Plan repayments" rows={repayments} /> : null}
      {surplusRecommendations.length ? <RowList title="Recommended surplus allocation" rows={surplusRecommendations} /> : null}
    </> : <Note>Accept a Financial Plan for this month to calculate allocation and surplus.</Note>}
  </FormCard>;
}

function RowList({ title, rows }: { title: string; rows: DebtPlanRow[] }) {
  return <View style={{ gap: 8 }}>
    <Divider />
    <Text style={{ color: v4.ink, fontFamily: v4Font, fontSize: 12.5, fontWeight: "800" }}>{title}</Text>
    {rows.map((row) => <View key={row.id} accessible accessibilityLabel={`${row.label}, ${php(row.amountCentavos)}${row.dueDate ? `, due ${row.dueDate}` : ""}`} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: v4.ink, fontFamily: v4Font, fontSize: 12.5, fontWeight: "600" }}>{row.label}</Text>{row.dueDate ? <Text style={{ color: v4.mut, fontFamily: v4Font, fontSize: 11, marginTop: 1 }}>Due {row.dueDate}</Text> : null}</View>
      <Text style={{ color: v4.ink, fontFamily: v4Font, fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{php(row.amountCentavos)}</Text>
    </View>)}
  </View>;
}

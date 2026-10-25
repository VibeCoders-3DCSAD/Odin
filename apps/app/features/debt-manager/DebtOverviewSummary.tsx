import React from "react";
import { Text, View } from "react-native";
import { AmountHero, v4Font } from "../../components/BudgieForm";
import type { DebtManagerSummary } from "./debtManagerSummary";
import { ProgressBar, formatPeso } from "./debtUi";

function progressCopy(summary: DebtManagerSummary): string {
  const { activeCount, paidOffCount, aheadCount, onTrackCount, behindCount, notScheduledCount } = summary.progress;
  if (activeCount === 0 && paidOffCount === 0) return "Add a debt or credit-card balance to begin tracking progress.";
  if (activeCount === 0) return `All ${paidOffCount} tracked ${paidOffCount === 1 ? "debt is" : "debts are"} paid off.`;
  const details = [`${activeCount} active`];
  if (paidOffCount > 0) details.push(`${paidOffCount} paid off`);
  if (aheadCount > 0) details.push(`${aheadCount} ahead`);
  if (onTrackCount > 0) details.push(`${onTrackCount} on track`);
  if (behindCount > 0) details.push(`${behindCount} behind target`);
  if (notScheduledCount > 0) details.push(`${notScheduledCount} without a schedule`);
  return details.join(" · ");
}

// The overview hero: what is still owed, with recorded payments as progress toward zero.
export default function DebtOverviewSummary({ summary, payoffDate }: { summary: DebtManagerSummary; payoffDate?: string }) {
  const trackedCentavos = summary.totalPaidCentavos + summary.currentDebtCentavos;
  return <View accessibilityLabel="Debt overview summary">
    <AmountHero label="REMAINING DEBT" amountCentavos={summary.currentDebtCentavos}>
      <Text style={{ fontFamily: v4Font, fontSize: 12, color: "rgba(255,255,255,0.78)", marginTop: 4 }}>{progressCopy(summary)}</Text>
      <View style={{ marginTop: 14 }}>
        <ProgressBar inverted label="Debt paid" valueLabel={formatPeso(summary.totalPaidCentavos)} ratio={trackedCentavos > 0 ? summary.totalPaidCentavos / trackedCentavos : 0} />
      </View>
      {payoffDate ? <Text style={{ fontFamily: v4Font, fontSize: 12.5, fontWeight: "700", color: "#FFFFFF", marginTop: 12 }}>Debt-free by {new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${payoffDate}T00:00:00Z`))}</Text> : null}
    </AmountHero>
  </View>;
}

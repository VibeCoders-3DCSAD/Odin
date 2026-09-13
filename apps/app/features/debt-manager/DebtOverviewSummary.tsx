import React from "react";
import { Text, View } from "react-native";
import type { DebtManagerSummary } from "./debtManagerSummary";

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;

function formatPeso(amountCentavos: number): string {
  return `PHP ${(amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  return details.join(" | ");
}

export default function DebtOverviewSummary({ summary }: { summary: DebtManagerSummary }) {
  return <View accessibilityLabel="Debt overview summary" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
    <View style={{ flexGrow: 1, flexBasis: 150, borderWidth: 1, borderColor: P.line, borderRadius: 14, padding: 14, backgroundColor: P.shell }}>
      <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Debt paid</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.brand, marginTop: 4 }}>{formatPeso(summary.totalPaidCentavos)}</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 4 }}>Recorded debt and statement payments</Text>
    </View>
    <View style={{ flexGrow: 1, flexBasis: 150, borderWidth: 1, borderColor: P.line, borderRadius: 14, padding: 14, backgroundColor: P.shell }}>
      <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>Overall progress</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink, marginTop: 4 }}>{formatPeso(summary.currentDebtCentavos)} remaining</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 4 }}>{progressCopy(summary)}</Text>
    </View>
  </View>;
}

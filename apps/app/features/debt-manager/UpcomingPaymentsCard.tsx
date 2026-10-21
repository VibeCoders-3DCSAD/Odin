import React from "react";
import { Text, View } from "react-native";
import type { UpcomingDebtPayment } from "./upcomingDebtPayments";

const P = { shell: "#fcf8f0", brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6", overdue: "#B45309" } as const;

function formatPeso(centavos: number): string {
  return `PHP ${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export default function UpcomingPaymentsCard({ payments, today }: { payments: UpcomingDebtPayment[]; today: string }) {
  const totalCentavos = payments.reduce((total, payment) => total + payment.remainingCentavos, 0);
  return <View accessibilityLabel="Upcoming debt payments" style={{ backgroundColor: P.shell, borderColor: P.line, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 }}>
    <Text style={{ fontFamily: "Manrope", fontSize: 16, fontWeight: "800", color: P.ink }}>Upcoming Payments</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 4 }}>Unpaid payments due this month, including overdue payments.</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.muted, marginTop: 3 }}>Credit cards follow your saved statement payment targets.</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: "800", color: P.brand, marginTop: 10 }}>{formatPeso(totalCentavos)} remaining this month</Text>
    {payments.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.muted, marginTop: 10 }}>No unpaid debt payments due this month.</Text> : payments.map((payment) => {
      const overdue = payment.dueDate < today;
      return <View key={payment.id} accessibilityLabel={`${payment.name}, due ${payment.dueDate}, ${formatPeso(payment.remainingCentavos)} unpaid${overdue ? ", overdue" : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: P.line, marginTop: 10, paddingTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, fontWeight: "700", color: P.ink }}>{payment.name}</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 11, color: overdue ? P.overdue : P.muted, marginTop: 3 }}>{payment.kind === "credit_card_statement" ? "Statement" : "Scheduled payment"} · {overdue ? "Overdue" : "Due"} {formatDate(payment.dueDate)}</Text>
        </View>
        <Text style={{ fontFamily: "Manrope", fontSize: 12, fontWeight: "700", color: P.ink }}>{formatPeso(payment.remainingCentavos)}</Text>
      </View>;
    })}
  </View>;
}

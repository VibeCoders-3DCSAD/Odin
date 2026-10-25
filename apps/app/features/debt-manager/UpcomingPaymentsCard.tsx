import React from "react";
import { Text, View } from "react-native";
import { CalendarBlank, CreditCard } from "phosphor-react-native";
import { Note, v4, v4Font } from "../../components/BudgieForm";
import type { UpcomingDebtPayment } from "./upcomingDebtPayments";
import { List, ListRow, SectionHeader, formatPeso } from "./debtUi";

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export default function UpcomingPaymentsCard({ payments, today }: { payments: UpcomingDebtPayment[]; today: string }) {
  const totalCentavos = payments.reduce((total, payment) => total + payment.remainingCentavos, 0);
  return <View accessibilityLabel="Upcoming debt payments" style={{ gap: 10 }}>
    <SectionHeader title="Upcoming Payments" />
    <Text style={{ fontFamily: v4Font, fontSize: 13, fontWeight: "700", color: v4.ink, marginTop: -4 }}>{formatPeso(totalCentavos)} remaining this month</Text>
    {payments.length === 0 ? <List><ListRow title="No unpaid debt payments due this month." /></List> : <List>{payments.map((payment, index) => {
      const overdue = payment.dueDate < today;
      const statement = payment.kind === "credit_card_statement";
      return <ListRow
        key={payment.id}
        divider={index > 0}
        accessibilityLabel={`${payment.name}, due ${payment.dueDate}, ${formatPeso(payment.remainingCentavos)} unpaid${overdue ? ", overdue" : ""}`}
        icon={statement ? <CreditCard size={17} color={overdue ? "#8A0000" : "#0E6D46"} weight="bold" /> : <CalendarBlank size={17} color={overdue ? "#8A0000" : "#0E6D46"} weight="bold" />}
        tint={overdue ? { bg: "#FCEDEF", fg: "#8A0000" } : undefined}
        title={payment.name}
        subtitle={`${statement ? "Statement" : "Scheduled payment"} · ${overdue ? "Overdue" : "Due"} ${formatDate(payment.dueDate)}`}
        subtitleTone={overdue ? "err" : undefined}
        value={formatPeso(payment.remainingCentavos)}
      />;
    })}</List>}
    <Note>Unpaid payments due this month, including overdue payments. Credit cards follow your saved statement payment targets.</Note>
  </View>;
}

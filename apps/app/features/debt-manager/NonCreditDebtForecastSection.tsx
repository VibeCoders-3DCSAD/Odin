import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { DebtAccount } from "../../local-db/repositories/debtAccounts";
import type { DebtPayment } from "../../local-db/repositories/debtPayments";
import { buildDebtForecast, type DebtForecastStatus } from "./debtForecast";
import { DebtForecastChart } from "./DebtForecastChart";
import { DebtForecastTable } from "./DebtForecastTable";
import { groupMissedPaymentPoints } from "./debtForecastPresentation";
import { filterDebtTrendPoints, getPhilippineToday, type DebtTrendRange } from "./debtTrendRange";

const P = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;
const CHART_HEIGHT = 220;

function formatMilestoneDate(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function statusLabel(status: DebtForecastStatus): string {
  if (status === "ahead") return "Ahead";
  if (status === "behind") return "Behind";
  if (status === "on_track") return "On track";
  if (status === "paid_off") return "Paid off";
  return "No schedule";
}

export default function NonCreditDebtForecastSection({ debt, payments }: { debt: DebtAccount; payments: DebtPayment[] }) {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<DebtTrendRange>("year");
  const forecast = buildDebtForecast(debt, undefined, payments.map((payment) => ({ paymentDate: payment.payment_date, amountCentavos: payment.amount_centavos })));
  const { points } = forecast;
  const today = getPhilippineToday();
  const payoffDate = debt.status === "paid_off" ? debt.paidOffAt?.slice(0, 10) : forecast.projectedPayoffDate ?? undefined;
  const visiblePoints = filterDebtTrendPoints(points, range, payoffDate);
  const missedPaymentGroups = groupMissedPaymentPoints(visiblePoints);
  const balancePoints = visiblePoints.map((point, index) => ({ id: `${point.date}-${index}`, date: point.date, balanceCentavos: point.balanceCentavos, isForecast: point.date > today }));

  return <View style={{ borderTopWidth: 1, borderTopColor: P.line, marginTop: 18, paddingTop: 16 }} accessibilityLabel={`Debt repayment forecast${payoffDate ? `, projected debt-free ${payoffDate}` : ""}`}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>Debt repayment forecast</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 4 }}>{debt.status === "paid_off" ? "This debt has been paid off." : debt.interestMethod === "provider_calculated" ? "Projected from your current balance and scheduled contributions." : "Projected from your current balance, scheduled contributions, and interest."}</Text>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 11.5, color: forecast.status === "ahead" || forecast.status === "paid_off" ? "#087443" : forecast.status === "behind" ? "#B45309" : "#2563EB", marginTop: 8 }}>{statusLabel(forecast.status)}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{(["month", "year", "payoff", "all"] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={option === "payoff" ? "Show today until debt free" : option === "all" ? "Show all projected payments" : `Show 1 ${option}`} disabled={option === "payoff" && !payoffDate} onPress={() => setRange(option)} style={{ borderWidth: 1, borderColor: range === option ? P.ink : P.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, opacity: option === "payoff" && !payoffDate ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: P.ink }}>{option === "payoff" ? "Today to debt-free" : option === "all" ? "All" : `1 ${option}`}</Text></Pressable>)}</View>
    {payoffDate ? <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#E8F5ED" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 12, color: "#087443" }}>{debt.status === "paid_off" ? "Paid off" : `Debt-free by ${formatMilestoneDate(payoffDate)}`}</Text><Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 2 }}>Based on your scheduled contributions.</Text></View> : null}
    {forecast.status === "behind" ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.ink, marginTop: 8 }}>Behind target: this schedule does not clear the debt by {debt.targetPayoffDate ?? "the target payoff date"}.</Text> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }} accessibilityLabel="Chart legend: solid line actual balance, dashed line forecast">
      <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted }}>Solid: Actual balance</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted }}>Dashed: Forecast</Text>
    </View>
    {visiblePoints.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 10 }}>No scheduled debt payments fall in this calendar window.</Text> : <><View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))} style={{ height: CHART_HEIGHT, marginTop: 10 }}>{width > 0 ? <DebtForecastChart points={balancePoints} status={forecast.status} today={today} width={width} colorMode="status" /> : null}</View><DebtForecastTable points={balancePoints} milestoneDate={payoffDate} /></>}
    {missedPaymentGroups.map((group) => <View key={`${group.startDate}-${group.endDate}`} accessibilityLabel={`${group.count} missed payments from ${group.startDate} to ${group.endDate}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
      <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted }}>{group.count} missed payments, {group.startDate} to {group.endDate}</Text>
      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11.5, color: P.ink }}>PHP {(group.balanceCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
    </View>)}
    <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 8 }}>{debt.interestMethod === "provider_calculated" ? "Each projected contribution is the greater of the minimum payment and the highest recorded payment. Provider-calculated interest, fees, and extra payments are excluded." : "Each projected contribution is the greater of the minimum payment and the highest recorded payment. Interest is added on dates anchored to the debt start date."}</Text>
  </View>;
}

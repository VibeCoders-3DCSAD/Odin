import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit/v2";
import type { DebtAccount } from "../../local-db/repositories/debtAccounts";
import type { DebtPayment } from "../../local-db/repositories/debtPayments";
import { buildDebtForecast } from "./debtForecast";
import { filterDebtTrendPoints, type DebtTrendRange } from "./debtTrendRange";

const P = { ink: "#1B1C1A", muted: "#6B7A6F", line: "#EAEAE6" } as const;
const CHART_HEIGHT = 280;

export default function NonCreditDebtForecastSection({ debt, payments }: { debt: DebtAccount; payments: DebtPayment[] }) {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<DebtTrendRange>("year");
  const forecast = buildDebtForecast(debt, undefined, payments.map((payment) => ({ paymentDate: payment.payment_date, amountCentavos: payment.amount_centavos })));
  const { points } = forecast;
  const payoffDate = debt.status === "paid_off" ? debt.paidOffAt?.slice(0, 10) : forecast.projectedPayoffDate ?? undefined;
  const visiblePoints = filterDebtTrendPoints(points, range, payoffDate);
  const yAxisMaximum = Math.max(1, ...visiblePoints.map((point) => point.balanceCentavos / 100));

  return <View style={{ borderTopWidth: 1, borderTopColor: P.line, marginTop: 18, paddingTop: 16 }} accessibilityLabel={`Debt repayment forecast${payoffDate ? `, projected debt-free ${payoffDate}` : ""}`}>
    <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>Debt repayment forecast</Text>
    <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 4 }}>{debt.status === "paid_off" ? "This debt has been paid off." : debt.interestMethod === "provider_calculated" ? "Projected from your current balance and scheduled contributions." : "Projected from your current balance, scheduled contributions, and interest."}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{(["month", "year", "payoff", "all"] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={option === "payoff" ? "Show today until debt free" : option === "all" ? "Show all projected payments" : `Show 1 ${option}`} disabled={option === "payoff" && !payoffDate} onPress={() => setRange(option)} style={{ borderWidth: 1, borderColor: range === option ? P.ink : P.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, opacity: option === "payoff" && !payoffDate ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 11, color: P.ink }}>{option === "payoff" ? "Today to debt-free" : option === "all" ? "All" : `1 ${option}`}</Text></Pressable>)}</View>
    {payoffDate ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.ink, marginTop: 8 }}>{debt.status === "paid_off" ? "Paid off:" : "Projected debt-free:"} {payoffDate}</Text> : null}
    {forecast.status === "behind" ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.ink, marginTop: 8 }}>Behind target: this schedule does not clear the debt by {debt.targetPayoffDate ?? "the target payoff date"}.</Text> : null}
    {visiblePoints.length === 0 ? <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.muted, marginTop: 10 }}>No scheduled debt payments fall in this calendar window.</Text> : <View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))} style={{ height: CHART_HEIGHT, marginTop: 10 }}>{width > 0 ? <LineChart data={visiblePoints.map((point) => ({ date: point.date, debt: point.balanceCentavos / 100 }))} xKey="date" series={[{ yKey: "debt", label: "Debt balance", color: "#08B16A" }]} width={width} height={CHART_HEIGHT} yDomain={{ min: 0, max: yAxisMaximum, nice: false }} formatXLabel={(value) => String(value).slice(5)} formatYLabel={(value) => `PHP ${Number(value).toLocaleString("en-PH", { notation: "compact", maximumFractionDigits: 1 })}`} yAxisLabelWidth="stable" showHorizontalGridLines labelStrategy="auto" edgeLabelPolicy="shift" dots={{ radius: 3, fill: "series" }} activeDot={{ radius: 5, fill: "background", stroke: "series" }} interaction={{ mode: "tap", selectionPersistence: "whileActive" }} tooltip={{ shared: true }} accessibilityLabel="Projected debt balance over time" /> : null}</View>}
    <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: P.muted, marginTop: 8 }}>{debt.interestMethod === "provider_calculated" ? "Each projected contribution is the greater of the minimum payment and the highest recorded payment. Provider-calculated interest, fees, and extra payments are excluded." : "Each projected contribution is the greater of the minimum payment and the highest recorded payment. Interest is added on dates anchored to the debt start date."}</Text>
  </View>;
}

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import AnomalyAlertsScreen from "../alerts/AnomalyAlertsScreen";
import SpendingForecastScreen from "../forecast/SpendingForecastScreen";
import {
  AccountSummarySection,
  AllocationSummarySection,
  BudgetActualSection,
  CategoryBreakdownSection,
  CashFlowSection,
  DebtSummarySection,
  ExpenseDistributionSection,
  ForecastActualSection,
  SavingsProgressSection,
} from "./ReportSections";
import { cashFlowComparisonFor, rangeFor, type ReportPeriod } from "./reportRange";
import { refreshFinancialReport } from "./api";

type Props = { userId: string; accessToken: string };

const P = { brand: "#013220", ink: "#1B1C1A", muted: "#6B7A6F", tint: "#EFFEF7" };

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "this_year", label: "This year" },
  { value: "this_week", label: "This week" },
];

export default function FinancialReportsScreen({ userId, accessToken }: Props) {
  const [period, setPeriod] = useState<ReportPeriod>("this_month");
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const range = rangeFor(period);
  const cashFlowComparison = cashFlowComparisonFor(period);

  return <View>
    <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 22, fontWeight: "800" }}>Financial Reports</Text>
    <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 14, lineHeight: 21, marginTop: 5 }}>
      A clear read on your money, from cash flow to goals and debt.
    </Text>

    <Text style={{ color: P.ink, fontFamily: "Manrope", fontSize: 13, fontWeight: "800", marginTop: 20 }}>Reporting period</Text>
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
      {PERIODS.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: period === option.value }} onPress={() => setPeriod(option.value)} style={{ flex: 1, alignItems: "center", backgroundColor: period === option.value ? P.brand : P.tint, borderRadius: 10, paddingVertical: 9 }}>
        <Text style={{ color: period === option.value ? "#FFFFFF" : P.brand, fontFamily: "Manrope", fontSize: 11, fontWeight: "800" }}>{option.label}</Text>
      </Pressable>)}
    </View>
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 7 }}>
      <Text style={{ color: P.muted, fontFamily: "Manrope", fontSize: 11 }}>{range.startDate} to {range.endDate}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh financial report" disabled={refreshing} onPress={() => {
        setRefreshing(true);
        void refreshFinancialReport(accessToken).catch(() => {}).finally(() => {
          setRefreshKey((value) => value + 1);
          setRefreshing(false);
        });
      }} hitSlop={8}>
        <Text style={{ color: P.brand, fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>{refreshing ? "Refreshing..." : "Refresh"}</Text>
      </Pressable>
    </View>

    <View style={{ gap: 14, marginTop: 20 }}>
      <ExpenseDistributionSection userId={userId} range={range} refreshKey={refreshKey} />
      <CashFlowSection userId={userId} range={range} comparison={cashFlowComparison} refreshKey={refreshKey} />
      <AccountSummarySection userId={userId} comparison={cashFlowComparison} refreshKey={refreshKey} />
      <BudgetActualSection userId={userId} range={range} refreshKey={refreshKey} />
       <ForecastActualSection userId={userId} refreshKey={refreshKey} />
      <SavingsProgressSection userId={userId} refreshKey={refreshKey} />
      <DebtSummarySection userId={userId} refreshKey={refreshKey} />
      <CategoryBreakdownSection userId={userId} range={range} refreshKey={refreshKey} />
      <AllocationSummarySection userId={userId} range={range} refreshKey={refreshKey} />
    </View>

    <View style={{ marginTop: 32 }}><SpendingForecastScreen userId={userId} accessToken={accessToken} embedded /></View>
    <View style={{ marginTop: 32 }}><AnomalyAlertsScreen userId={userId} accessToken={accessToken} /></View>
  </View>;
}

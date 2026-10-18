import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendUp,
} from "phosphor-react-native";
import AvailableBalanceCard from "../../components/AvailableBalanceCard";
import { SnapshotCard } from "./components/SnapshotCard";
import { DashboardEmptyState } from "./components/DashboardEmptyState";
import { DashboardPartialData } from "./components/DashboardPartialData";
import { SpendingPie, TrendChart } from "./components/DashboardCharts";
import { ForecastPanel } from "./components/ForecastPanel";
import { FinancialHealthCard } from "./components/FinancialHealthCard";
import { SafeToSpendCard } from "./components/SafeToSpendCard";
import { getForecastContent, getSnapshotCentavos, getSnapshotCount, getSnapshotText } from "./dashboardSnapshotContent";
import { deltaPercent, formatPeso, formatPesoCompact, formatTransactionTime, getPreviousMonthName } from "./dashboardFormatting";
import { useDashboardData } from "./hooks/useDashboardData";
import { DEFAULT_TAXONOMY_COLOR, TaxonomyIcon } from "../taxonomy/taxonomyVisuals";
import type { CategorySpending } from "../../local-db/repositories/dashboardSummary";

const P = {
  shell: "#fcf8f0",
  brand: "#013220",
  brandMedium: "#0E6D46",
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#414942",
  line: "#EAEAE6",
  error: "#D9001F",
  card: "#F8EFDC",
  aqua50: "#EFFEF7",
  aqua100: "#D4F7E5",
  aqua300: "#7cf9c4",
  aqua600: "#08B16A",
  aqua700: "#066B40",
  aqua800: "#066B40",
  monza100: "#FFF0F2",
  monza600: "#D9001F",
  sun100: "#FFF3E0",
  sun400: "#E5A12B",
  sun500: "#C25E00",
  white: "#FFFFFF",
};

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onNavigate: (page: string) => void;
};

export default function DashboardScreen({ userId, deviceId, accessToken, onNavigate }: Props) {
  const { summary: s, trends, snapshots, loading, refreshing, summaryUnavailable, summaryStale, snapshotsUnavailable, error, refresh } = useDashboardData({ userId, deviceId, accessToken });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={P.brand} />
      </View>
    );
  }

  if (summaryUnavailable) {
    return <DashboardPartialData trends={trends} snapshots={snapshots} snapshotsUnavailable={snapshotsUnavailable} onRefresh={refresh} onNavigate={onNavigate} />;
  }

  const prevMonthName = getPreviousMonthName();
  const incomeDelta = deltaPercent(s.currentMonthIncomeCentavos, s.previousMonthIncomeCentavos);
  const expenseDelta = deltaPercent(s.currentMonthExpenseCentavos, s.previousMonthExpenseCentavos);
  const categoryExpenseTotal = s.categorySpending.reduce((sum, category) => sum + category.total_centavos, 0);
  const visibleSpending = s.categorySpending.slice(0, 4);
  const hiddenSpendingTotal = s.categorySpending.slice(4).reduce((sum, category) => sum + category.total_centavos, 0);
  const spendingGroups: CategorySpending[] = hiddenSpendingTotal > 0
    ? [...visibleSpending, { category_id: "remaining-categories", category_label: "Other categories", total_centavos: hiddenSpendingTotal, icon_key: "tag", color_hex: "#6B7A6F" }]
    : visibleSpending;

  const isEmpty = s.accountCount === 0
    && s.currentMonthIncomeCentavos === 0
    && s.currentMonthExpenseCentavos === 0
    && s.transactionCount === 0
    && s.categorySpending.length === 0;

  if (isEmpty && !summaryUnavailable) return <DashboardEmptyState onNavigate={onNavigate} />;

  // Forecast from snapshot
   const forecastSnap = snapshots.forecast;
  const forecast = getForecastContent(forecastSnap);
   const savingsSnap = snapshots.savings_goals;
  const savingsText = getSnapshotText(savingsSnap);
  const savingsCount = getSnapshotCount(savingsSnap);
  const savingsCentavos = getSnapshotCentavos(savingsSnap, ["saved_centavos", "current_amount_centavos"]);
  const savingsUnavailable = (snapshotsUnavailable && !savingsSnap) || (!!savingsSnap && !savingsText && savingsCount === null);
  const forecastUnavailable = snapshotsUnavailable && !forecastSnap;
  const staleSnapshot = (snapshot: typeof savingsSnap) => !!snapshot && (snapshot.stale || snapshotsUnavailable);

  return (
    <View>
      {error ? (
        <View style={{ padding: 20, borderRadius: 32, backgroundColor: P.monza100, marginBottom: 20 }}>
          <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.ink2 }}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry dashboard refresh" onPress={refresh} style={{ marginTop: 10 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.monza600 }}>Try again</Text></Pressable>
        </View>
      ) : null}
      {summaryStale ? <View style={{ padding: 20, borderRadius: 32, backgroundColor: P.aqua50, marginBottom: 20 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>Cached dashboard summary</Text><Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.ink2, marginTop: 6 }}>Balances, income, and expenses are from your last successful update.</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh cached dashboard summary" onPress={refresh} style={{ marginTop: 10 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.aqua700 }}>Refresh</Text></Pressable></View> : null}
      {s.accountCount === 0 && !summaryUnavailable ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Add account" onPress={() => onNavigate("financial-accounts")} style={{ marginBottom: 20, padding: 20, borderRadius: 32, backgroundColor: P.aqua50 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>Add an account</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.ink2, marginTop: 6 }}>Add an account to make your available balance accurate.</Text>
        </Pressable>
      ) : null}
      {/* Balance card */}
      <AvailableBalanceCard
        amount={(s.currentBalanceCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        detail={incomeDelta ? `${incomeDelta} vs last month` : undefined}
        detailPill
      />

      {/* Income / Expense cards */}
      <View style={{ flexDirection: "row", gap: 11, marginTop: 14 }}>
        <View style={{ flex: 1, minHeight: 106, padding: 20, borderRadius: 32, backgroundColor: P.card }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12, color: P.mut }}>Income</Text>
            <View style={{ width: 25, height: 25, borderRadius: 13, backgroundColor: P.aqua100, justifyContent: "center", alignItems: "center" }}>
              <ArrowDownLeft size={13} color={P.aqua700} weight="bold" />
        </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 9 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: P.mut, marginRight: 3 }}>PHP</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
              {Math.abs(s.currentMonthIncomeCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
          </View>
          {incomeDelta && (
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: P.aqua700, marginTop: 3 }}>{incomeDelta} from {prevMonthName}</Text>
          )}
        </View>

        <View style={{ flex: 1, minHeight: 106, padding: 20, borderRadius: 32, backgroundColor: P.card }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12, color: P.mut }}>Expenses</Text>
            <View style={{ width: 25, height: 25, borderRadius: 13, backgroundColor: "#FFDDE3", justifyContent: "center", alignItems: "center" }}>
              <ArrowUpRight size={13} color={P.monza600} weight="bold" />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 9 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: P.mut, marginRight: 3 }}>PHP</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: P.ink }}>
              {Math.abs(s.currentMonthExpenseCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
          </View>
          {expenseDelta && (
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: P.monza600, marginTop: 3 }}>{expenseDelta} from {prevMonthName}</Text>
          )}
        </View>
      </View>
      <View style={{ marginTop: 14, padding: 20, borderRadius: 32, backgroundColor: P.aqua50 }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: P.ink2 }}>Net monthly cash flow</Text><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: s.currentMonthIncomeCentavos - s.currentMonthExpenseCentavos >= 0 ? P.aqua800 : P.monza600, marginTop: 4 }}>{formatPeso(s.currentMonthIncomeCentavos - s.currentMonthExpenseCentavos)}</Text></View>

      <View style={{ flexDirection: "row", gap: 11, marginTop: 14 }}>
        <SnapshotCard title="Savings goals" stale={staleSnapshot(savingsSnap)} unavailable={savingsUnavailable} onRefresh={refresh} onNavigate={() => onNavigate("savings-goals")} actionLabel={!savingsSnap || savingsCount === 0 ? "Create a goal" : undefined} copy={savingsText ?? (savingsUnavailable ? "Savings goal information is unavailable." : !savingsSnap || savingsCount === 0 ? "No savings goals yet. Create one when you're ready." : savingsCount === null ? "Savings goal summary is unavailable. Refresh to try again." : `${savingsCount} savings goal${savingsCount === 1 ? "" : "s"} in progress${savingsCentavos === null ? "." : ` · ${formatPeso(savingsCentavos)} saved.`}`)} />
      </View>

      <FinancialHealthCard accessToken={accessToken} />

      {s.incomeSourceCount === 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Add an income source" onPress={() => onNavigate("income-sources")} style={{ marginTop: 20, padding: 20, borderRadius: 32, backgroundColor: P.aqua50 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.ink }}>Add an income source</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.ink2, marginTop: 6 }}>Set expected income to make your monthly plan more useful.</Text>
        </Pressable>
      ) : null}

      {/* Trends */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: P.ink }}>Trends</Text>
           {trends.length === 0 ? <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: P.mut }}>No chart data</Text> : <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: P.aqua700 }}>This month</Text>}
      </View>
      <View style={{ borderRadius: 32, backgroundColor: P.card, padding: 20, paddingBottom: 16 }}>
        <TrendChart data={trends} startingBalance={s.currentBalanceCentavos - (s.currentMonthIncomeCentavos - s.currentMonthExpenseCentavos)} colors={{ line: P.line, income: P.aqua600, expense: P.monza600, muted: P.mut }} />
        <View style={{ flexDirection: "row", gap: 18, paddingTop: 6, paddingHorizontal: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 14, height: 3, borderRadius: 3, backgroundColor: P.aqua600 }} />
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: P.mut }}>Balance</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 14, height: 3, borderRadius: 3, backgroundColor: P.monza600 }} />
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: P.mut }}>Expenses</Text>
          </View>
        </View>
      </View>

      {/* Spending */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: P.ink }}>Spending</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="View all spending categories" onPress={() => onNavigate("categories")}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: P.aqua700 }}>View all</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 32, backgroundColor: P.card, padding: 20 }}>
        <SpendingPie
          segments={spendingGroups.map((c) => ({
            label: c.category_label,
            value: c.total_centavos,
            color: c.color_hex ?? DEFAULT_TAXONOMY_COLOR,
          }))}
          total={categoryExpenseTotal}
          totalLabel={formatPesoCompact(categoryExpenseTotal)}
          line={P.line}
          muted={P.mut}
        />
        <View style={{ flex: 1, gap: 10 }}>
          {spendingGroups.map((c) => {
            const pct = categoryExpenseTotal > 0
              ? Math.round((c.total_centavos / categoryExpenseTotal) * 100)
              : 0;
            return (
              <View key={c.category_id ?? "uncategorized"} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.color_hex ?? DEFAULT_TAXONOMY_COLOR, alignItems: "center", justifyContent: "center" }}>
                  <TaxonomyIcon iconKey={c.icon_key} size={15} color="#fff" weight="fill" />
                </View>
                <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "500", fontSize: 12.5, color: P.ink2 }} numberOfLines={1}>{c.category_label}</Text>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12.5, color: P.ink }}>{pct}%</Text>
              </View>
            );
          })}
          {s.categorySpending.length === 0 && (
            <Text style={{ fontFamily: "Manrope", fontSize: 12, color: P.mut }}>No expenses this month</Text>
          )}
        </View>
      </View>

      {/* Recent */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 10 }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: P.ink }}>Recent</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="View all transactions" onPress={() => onNavigate("transactions")}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12.5, color: P.aqua700 }}>View all</Text>
        </Pressable>
      </View>
      <View style={{ gap: 2 }}>
        {s.recentTransactions.map((tx) => {
          const isIncome = tx.transaction_type === "income";
          const label = tx.merchant_name || tx.counterparty_name || tx.category_label || (isIncome ? "Income" : "Expense");
          return (
            <View key={tx.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tx.color_hex ?? DEFAULT_TAXONOMY_COLOR, justifyContent: "center", alignItems: "center" }}>
                <TaxonomyIcon iconKey={tx.icon_key} size={21} color="#fff" weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13.5, color: P.ink }} numberOfLines={1}>{label}</Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: P.mut }} numberOfLines={1}>{tx.category_label ?? (isIncome ? "Income" : "Expense")}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13.5, color: isIncome ? P.aqua700 : P.ink }}>
                  {isIncome ? "+" : "-"}{formatPeso(tx.amount_centavos)}
                </Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.mut }}>{formatTransactionTime(tx.transaction_date)}</Text>
              </View>
            </View>
          );
        })}
        {s.recentTransactions.length === 0 && s.transactionCount === 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Record a transaction" onPress={() => onNavigate("add-transaction")} style={{ paddingVertical: 20, alignItems: "center" }}>
            <Text style={{ fontFamily: "Manrope", fontSize: 13, color: P.mut }}>No recent transactions</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.aqua700, marginTop: 6 }}>Record income or an expense</Text>
          </Pressable>
        )}
        {s.recentTransactions.length === 0 && s.transactionCount > 0 && <Text style={{ paddingVertical: 20, textAlign: "center", fontFamily: "Manrope", fontSize: 13, color: P.mut }}>No expenses recorded yet</Text>}
      </View>

      <SafeToSpendCard userId={userId} reloadKey={s} onNavigate={onNavigate} />

      <ForecastPanel forecast={forecast} stale={staleSnapshot(forecastSnap)} unavailable={forecastUnavailable} onRefresh={refresh} onNavigate={() => onNavigate("spending-forecast")} />
       {refreshing ? <View style={{ alignItems: "center", marginTop: 12 }}><ActivityIndicator size="small" color={P.aqua700} /></View> : null}
    </View>
  );
}

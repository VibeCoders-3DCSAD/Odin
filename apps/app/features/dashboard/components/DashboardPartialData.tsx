import { Pressable, Text, View } from "react-native";
import type { DailyTrend } from "../../../local-db/repositories/dashboardSummary";
import type { DashboardSnapshotWithMeta } from "../../../local-db/repositories/dashboardSnapshots";
import { getForecastContent, getSnapshotCount, getSnapshotText } from "../dashboardSnapshotContent";
import { ForecastPanel } from "./ForecastPanel";
import { SnapshotCard } from "./SnapshotCard";
import { TrendChart } from "./DashboardCharts";

type Props = { trends: DailyTrend[]; snapshots: Record<string, DashboardSnapshotWithMeta | null>; snapshotsUnavailable: boolean; onRefresh: () => void; onNavigate: (page: string) => void };

export function DashboardPartialData({ trends, snapshots, snapshotsUnavailable, onRefresh, onNavigate }: Props) {
  const savings = snapshots.savings_goals;
  const debts = snapshots.debt_status;
  const alerts = snapshots.alerts;
  const forecastSnapshot = snapshots.forecast;
  const savingsCount = getSnapshotCount(savings);
  const debtCount = getSnapshotCount(debts);
  const alertCount = getSnapshotCount(alerts);
  const unavailable = (snapshot: DashboardSnapshotWithMeta | null | undefined) => snapshotsUnavailable && !snapshot;
  const stale = (snapshot: DashboardSnapshotWithMeta | null | undefined) => !!snapshot && (snapshot.stale || snapshotsUnavailable);

  return <View style={{ gap: 20 }}>
    <View style={{ padding: 20, borderRadius: 32, backgroundColor: "#FFF0F2" }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: "#1B1C1A" }}>Dashboard summary unavailable</Text><Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: "#414942", marginTop: 6 }}>Balances, income, and expenses could not be loaded. Available trends and insights remain below.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry dashboard refresh" onPress={onRefresh} style={{ marginTop: 14 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#D9001F" }}>Try again</Text></Pressable></View>
    <View><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: "#1B1C1A", marginBottom: 12 }}>Expense trends</Text><View style={{ padding: 20, borderRadius: 32, backgroundColor: "#F8EFDC" }}><TrendChart data={trends} startingBalance={null} colors={{ line: "#EAEAE6", income: "#08B16A", expense: "#D9001F", muted: "#414942" }} /></View></View>
    <View style={{ flexDirection: "row", gap: 11 }}>
      <SnapshotCard title="Savings goals" stale={stale(savings)} unavailable={unavailable(savings)} onRefresh={onRefresh} onNavigate={() => onNavigate("savings-goals")} actionLabel={!savings || savingsCount === 0 ? "Create a goal" : undefined} copy={getSnapshotText(savings) ?? (unavailable(savings) ? "Savings information is unavailable." : !savings || savingsCount === 0 ? "No savings goals yet." : savingsCount === null ? "Savings goal summary is unavailable. Refresh to try again." : `${savingsCount} savings goals in progress.`)} />
      <SnapshotCard title="Debt" stale={stale(debts)} unavailable={unavailable(debts)} onRefresh={onRefresh} onNavigate={() => onNavigate("debt-manager")} copy={getSnapshotText(debts) ?? (unavailable(debts) ? "Debt information is unavailable." : !debts || debtCount === 0 ? "No debts are currently recorded." : debtCount === null ? "Debt summary is unavailable. Refresh to try again." : `${debtCount} debts being tracked.`)} />
    </View>
    <SnapshotCard title={typeof alertCount === "number" && alertCount > 0 ? `${alertCount} alerts` : "Alerts"} stale={stale(alerts)} unavailable={unavailable(alerts)} onRefresh={onRefresh} onNavigate={() => onNavigate("anomaly-alerts")} copy={getSnapshotText(alerts) ?? (unavailable(alerts) ? "Alerts are unavailable." : !alerts || alertCount === 0 ? "There are no alerts to review." : "Alert summary is unavailable. Refresh to try again.")} />
    <ForecastPanel forecast={getForecastContent(forecastSnapshot)} stale={stale(forecastSnapshot)} unavailable={unavailable(forecastSnapshot)} onRefresh={onRefresh} onNavigate={() => onNavigate("spending-forecast")} />
  </View>;
}

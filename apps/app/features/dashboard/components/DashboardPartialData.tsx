import { Pressable, Text, View } from "react-native";
import { dashboardColors as P, dashboardStyles } from "../dashboardAppearance";
import type { DailyTrend } from "../../../local-db/repositories/dashboardSummary";
import type { DashboardSnapshotWithMeta } from "../../../local-db/repositories/dashboardSnapshots";
import { getForecastContent, getSnapshotCount, getSnapshotText } from "../dashboardSnapshotContent";
import { ForecastPanel } from "./ForecastPanel";
import { SnapshotCard } from "./SnapshotCard";
import { TrendChart } from "./DashboardCharts";

type Props = { trends: DailyTrend[]; snapshots: Record<string, DashboardSnapshotWithMeta | null>; snapshotsUnavailable: boolean; onRefresh: () => void; onNavigate: (page: string) => void };

export function DashboardPartialData({ trends, snapshots, snapshotsUnavailable, onRefresh, onNavigate }: Props) {
  const savings = snapshots.savings_goals;
  const forecastSnapshot = snapshots.forecast;
  const savingsCount = getSnapshotCount(savings);
  const unavailable = (snapshot: DashboardSnapshotWithMeta | null | undefined) => snapshotsUnavailable && !snapshot;
  const stale = (snapshot: DashboardSnapshotWithMeta | null | undefined) => !!snapshot && (snapshot.stale || snapshotsUnavailable);

  return <View style={{ gap: 20 }}>
    <View style={[dashboardStyles.card, { backgroundColor: P.pink }]}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink }}>Dashboard summary unavailable</Text><Text style={{ fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: P.secondary, marginTop: 6 }}>Balances, income, and expenses could not be loaded. Available trends and insights remain below.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry dashboard refresh" onPress={onRefresh} style={{ marginTop: 14 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: P.error }}>Try again</Text></Pressable></View>
    <View><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: P.ink, marginBottom: 12 }}>Expense trends</Text><View style={dashboardStyles.card}><TrendChart data={trends} startingBalance={null} colors={{ line: P.divider, income: P.green, expense: P.error, muted: P.secondary }} /></View></View>
    <View style={{ flexDirection: "row", gap: 11 }}>
      <SnapshotCard title="Savings goals" stale={stale(savings)} unavailable={unavailable(savings)} onRefresh={onRefresh} onNavigate={() => onNavigate("savings-goals")} actionLabel={!savings || savingsCount === 0 ? "Create a goal" : undefined} copy={getSnapshotText(savings) ?? (unavailable(savings) ? "Savings information is unavailable." : !savings || savingsCount === 0 ? "No savings goals yet." : savingsCount === null ? "Savings goal summary is unavailable. Refresh to try again." : `${savingsCount} savings goals in progress.`)} />
    </View>
    <ForecastPanel forecast={getForecastContent(forecastSnapshot)} stale={stale(forecastSnapshot)} unavailable={unavailable(forecastSnapshot)} onRefresh={onRefresh} onNavigate={() => onNavigate("spending-forecast")} />
  </View>;
}

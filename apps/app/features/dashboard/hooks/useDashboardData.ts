import { useCallback, useEffect, useRef, useState } from "react";
import { getDashboardSummary, getDailyTrends } from "../../../local-db/repositories/dashboardSummary";
import type { DashboardSummary, DailyTrend } from "../../../local-db/repositories/dashboardSummary";
import { getAllSnapshots, upsertSnapshot } from "../../../local-db/repositories/dashboardSnapshots";
import type { DashboardSnapshotWithMeta } from "../../../local-db/repositories/dashboardSnapshots";
import { requestForecast } from "../../forecast/api";
import { listForecastTransactions } from "../../../local-db/repositories/forecastTransactions";
import { runSync } from "../../../local-db/sync/runSync";

const EMPTY_SUMMARY: DashboardSummary = {
  currentBalanceCentavos: 0,
  currentMonthIncomeCentavos: 0,
  currentMonthExpenseCentavos: 0,
  previousMonthIncomeCentavos: 0,
  previousMonthExpenseCentavos: 0,
  accountCount: 0,
  incomeSourceCount: 0,
  budgetCount: 0,
  transactionCount: 0,
  recentTransactions: [],
  categoryGroupSpending: [],
};

type DashboardDataParams = { userId: string; deviceId: string; accessToken: string };

export async function loadDashboardData(userId: string) {
  const [summary, trends, snapshots] = await Promise.allSettled([
    getDashboardSummary(userId),
    getDailyTrends(userId),
    getAllSnapshots(userId),
  ]);
  const failed = [summary, trends, snapshots].some((result) => result.status === "rejected");
  return {
    summary: summary.status === "fulfilled" ? summary.value : null,
    trends: trends.status === "fulfilled" ? trends.value : null,
    snapshots: snapshots.status === "fulfilled" ? snapshots.value : null,
    summaryUnavailable: summary.status === "rejected",
    snapshotsUnavailable: snapshots.status === "rejected",
    error: failed ? "Some dashboard information is unavailable. Try refreshing to recover it." : null,
  };
}

export async function refreshDashboardData(userId: string, deviceId: string, accessToken: string): Promise<boolean> {
  try {
    const result = await runSync(userId, deviceId, accessToken, { maxAttempts: 3 });
    if (!result.successful) return false;
    try {
      const historicalTransactions = await listForecastTransactions(userId);
      if (historicalTransactions.length > 0) {
        const forecast = await requestForecast(accessToken, {
          historicalTransactions,
          forecastHorizon: "MONTHLY",
          forecastLevel: "TOTAL",
        });
        if (forecast.response.ok && forecast.body.payload) {
          await upsertSnapshot(userId, "forecast", forecast.body.payload);
        }
      }
    } catch {
      // ponytail: forecast is best-effort; a stale snapshot beats failing the refresh
    }
    return true;
  } catch {
    return false;
  }
}

export function useDashboardData({ userId, deviceId, accessToken }: DashboardDataParams) {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, DashboardSnapshotWithMeta | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [summaryStale, setSummaryStale] = useState(false);
  const hasSummary = useRef(false);
  const [snapshotsUnavailable, setSnapshotsUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await loadDashboardData(userId);
    if (next.summary) {
      setSummary(next.summary);
      hasSummary.current = true;
      setSummaryUnavailable(false);
      setSummaryStale(false);
    } else {
      setSummaryUnavailable(!hasSummary.current);
      setSummaryStale(hasSummary.current);
    }
    if (next.trends) setTrends(next.trends);
    if (next.snapshots) setSnapshots(next.snapshots);
    setSnapshotsUnavailable(next.snapshotsUnavailable);
    setError(next.error);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!await refreshDashboardData(userId, deviceId, accessToken)) throw new Error("sync_failed");
      await load();
    } catch {
      setError("Dashboard refresh failed. Check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  }, [accessToken, deviceId, load, userId]);

  return { summary, trends, snapshots, loading, refreshing, summaryUnavailable, summaryStale, snapshotsUnavailable, error, refresh };
}

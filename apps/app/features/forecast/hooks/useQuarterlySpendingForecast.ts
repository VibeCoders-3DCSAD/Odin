import { useEffect, useRef, useState } from "react";
import { getSnapshot, upsertSnapshot } from "../../../local-db/repositories/dashboardSnapshots";
import { getForecastHistoryStartDate, listForecastTransactions, listQuarterlySpending, pastQuarters, type QuarterSpending } from "../../../local-db/repositories/forecastTransactions";
import { listScheduledPayments } from "../../../local-db/repositories/scheduledPayments";
import { getQuarterlyForecastContent } from "../../dashboard/dashboardSnapshotContent";
import { requestForecastInterpretation, requestQuarterlyForecast } from "../api";
import { forecastInterpretation } from "../QuarterlyForecastCharts";
import { addScheduledPayments } from "../scheduledForecast";
import type { QuarterlyForecastPayload } from "../types";

const HISTORY_QUARTERS = 4;

export function useQuarterlySpendingForecast(userId: string, accessToken: string, refreshKey: number) {
  const [forecast, setForecast] = useState<QuarterlyForecastPayload | null>(null);
  const [history, setHistory] = useState<QuarterSpending[]>([]);
  const [refreshing, setRefreshing] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasForecast = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setRefreshing(true);
    setError(null);
    setNotice(null);

    // Actual history can arrive later without delaying the saved forecast or its refresh.
    void listQuarterlySpending(userId, pastQuarters(HISTORY_QUARTERS)).then((actual) => {
      if (signal.aborted) return;
      const firstRecorded = actual.findIndex((quarter) => quarter.totalCentavos > 0);
      setHistory(firstRecorded === -1 ? [] : actual.slice(firstRecorded));
    }).catch(() => {});

    async function revalidate() {
      try {
        const historicalTransactions = await listForecastTransactions(userId, { fromDate: getForecastHistoryStartDate(), excludeScheduledPayments: true, excludeUnusualSpending: true });
        if (signal.aborted) return;
        if (historicalTransactions.length === 0) {
          setNotice("Record a posted income or expense before requesting a forecast.");
          return;
        }
        const result = await requestQuarterlyForecast(accessToken, { historicalTransactions }, signal);
        if (signal.aborted) return;
        if (result.response.ok && result.body.payload === null && result.body.reason) {
          setNotice(result.body.message ?? "A spending forecast isn't available yet.");
          return;
        }
        if (!result.response.ok || !result.body.payload) throw new Error("forecast_request_failed");
        const payload = addScheduledPayments(result.body.payload, await listScheduledPayments(userId));
        if (signal.aborted) return;
        await upsertSnapshot(userId, "forecast_quarterly", payload);
        if (signal.aborted) return;
        setForecast(payload);
        setStale(false);
        setRefreshing(false);
        hasForecast.current = true;

        const notes = forecastInterpretation(payload);
        if (notes.length === 0) return;
        // Updated numbers and the app's notes are ready before optional rewritten wording.
        const interpretation = await requestForecastInterpretation(accessToken, notes, signal).catch(() => null);
        if (signal.aborted) return;
        const rewritten = interpretation?.response.ok ? interpretation.body.payload?.notes : undefined;
        if (rewritten?.length === notes.length) {
          const interpreted = { ...payload, interpretation: rewritten };
          await upsertSnapshot(userId, "forecast_quarterly", interpreted);
          if (!signal.aborted) setForecast(interpreted);
        }
      } catch {
        if (signal.aborted) return;
        setError(hasForecast.current ? "Forecast update failed. Your last forecast is still available." : "Forecast update failed. Try refreshing again.");
      } finally {
        if (!signal.aborted) setRefreshing(false);
      }
    }

    async function loadCachedForecast() {
      try {
        const saved = await getSnapshot(userId, "forecast_quarterly");
        if (signal.aborted) return;
        const cached = saved?.user_id === userId ? getQuarterlyForecastContent(saved) : null;
        if (cached) {
          setForecast(cached);
          setStale(saved?.stale ?? false);
          hasForecast.current = true;
        }
      } catch {
        // A failed cache read still allows a fresh forecast to be requested.
      }
      if (!signal.aborted) await revalidate();
    }

    void loadCachedForecast();
    return () => controller.abort();
  }, [userId, accessToken, refreshKey]);

  return { forecast, history, refreshing, stale, error, notice };
}

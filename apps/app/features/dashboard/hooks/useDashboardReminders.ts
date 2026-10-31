import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getDashboardReminders } from "../../../local-db/repositories/dashboard/dashboardReminders";
import { localToday } from "../../billers/schedule";
import type { DashboardReminders } from "../types";

export function useDashboardReminders(userId: string, reloadKey: string) {
  const [state, setState] = useState<{ userId: string; data: DashboardReminders | null; loading: boolean }>({ userId, data: null, loading: true });
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    setState((current) => ({ userId, data: current.userId === userId ? current.data : null, loading: true }));
    try {
      const data = await getDashboardReminders(userId);
      if (version === request.current) setState({ userId, data, loading: false });
    } catch {
      if (version === request.current) setState({ userId, loading: false, data: { attention: { items: [], unavailable: true }, upcoming: { items: [], unavailable: true } } });
    }
  }, [userId]);
  useEffect(() => {
    void refresh();
    let day = localToday();
    const listener = AppState.addEventListener("change", (state) => { if (state === "active") { day = localToday(); void refresh(); } });
    const timer = setInterval(() => { const next = localToday(); if (next !== day) { day = next; void refresh(); } }, 60_000);
    return () => { ++request.current; listener.remove(); clearInterval(timer); };
  }, [refresh, reloadKey]);
  return { data: state.userId === userId ? state.data : null, loading: state.userId !== userId || state.loading, refresh };
}

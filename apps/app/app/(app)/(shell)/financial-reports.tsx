import { useLocalSearchParams } from "expo-router";
import { useCallback, useRef, type MutableRefObject } from "react";
import { useSession } from "../../../features/auth/components/AccessProvider";
import FinancialReportsScreen from "../../../features/reports/FinancialReportsScreen";
import { InnerPage } from "../../../features/shell/components/InnerPage";
import { useShellPage } from "../../../features/shell/components/PageScroll";
import { useSync } from "../../../features/sync/SyncProvider";

function Reports({ followForecast }: { followForecast: MutableRefObject<boolean> }) {
  const { accessToken, userId, deviceId } = useSession();
  const { syncVersion } = useSync();
  const { scrollTo } = useShellPage();
  const scrollToForecast = useCallback((y: number) => { if (followForecast.current) scrollTo(y); }, [followForecast, scrollTo]);
  return <FinancialReportsScreen userId={userId} deviceId={deviceId} accessToken={accessToken} syncVersion={syncVersion} onForecastLayout={scrollToForecast} />;
}

// ?focus=forecast (the dashboard's forecast link) keeps the forecast in view as the page lays out,
// until the user scrolls themselves.
export default function FinancialReportsRoute() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const followForecast = useRef(focus === "forecast");
  return <InnerPage title="Financial Reports" onScrollBeginDrag={() => { followForecast.current = false; }}>
    <Reports followForecast={followForecast} />
  </InnerPage>;
}

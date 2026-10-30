import { useLocalSearchParams } from "expo-router";
import AnomalyAlertsScreen from "../../../features/alerts/AnomalyAlertsScreen";
import { useSession } from "../../../features/auth/components/AccessProvider";
import { InnerPage } from "../../../features/shell/components/InnerPage";
import { useShellPage } from "../../../features/shell/components/PageScroll";
import { parseRouteId } from "../../../lib/routeParams";

function Alerts({ transactionId }: { transactionId?: string }) {
  const { userId, deviceId } = useSession();
  const { goBack } = useShellPage();
  return <AnomalyAlertsScreen userId={userId} deviceId={deviceId} initialTransactionId={transactionId} onBack={goBack} />;
}

// ?transactionId= highlights that alert (dashboard observations); the screen only matches it against this user's alerts.
export default function SpendingAlertsRoute() {
  const { transactionId } = useLocalSearchParams<{ transactionId?: string }>();
  return <InnerPage title="Spending alerts"><Alerts transactionId={parseRouteId(transactionId)} /></InnerPage>;
}

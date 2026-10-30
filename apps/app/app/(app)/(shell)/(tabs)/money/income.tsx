import { router } from "expo-router";
import { useSession } from "../../../../../features/auth/components/AccessProvider";
import IncomeSourcesScreen from "../../../../../features/income-sources/IncomeSourcesScreen";
import { incomeSourceHref } from "../../../../../features/money/moneyRoutes";
import { useSync } from "../../../../../features/sync/SyncProvider";
import { ROUTES } from "../../../../../routes";

export default function IncomeRoute() {
  const { userId, deviceId } = useSession();
  const { handleSync } = useSync();
  return <IncomeSourcesScreen userId={userId} deviceId={deviceId} onBack={() => router.navigate(ROUTES.dashboard)}
    onAdd={() => router.push(ROUTES.incomeSourceNew)} onEdit={(id) => router.push(incomeSourceHref(id))} onSyncRequested={handleSync} />;
}

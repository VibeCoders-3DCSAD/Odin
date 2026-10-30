import { router } from "expo-router";
import { useSession } from "../../../../../features/auth/components/AccessProvider";
import IncomeSourcesScreen from "../../../../../features/income-sources/IncomeSourcesScreen";
import { useSync } from "../../../../../features/sync/SyncProvider";
import { ROUTES } from "../../../../../routes";

// TODO(money routes): onAdd/onEdit open the income source form once it has a route.
const notRoutedYet = () => {};

export default function IncomeRoute() {
  const { userId, deviceId } = useSession();
  const { handleSync } = useSync();
  return <IncomeSourcesScreen userId={userId} deviceId={deviceId} onBack={() => router.navigate(ROUTES.dashboard)}
    onAdd={notRoutedYet} onEdit={notRoutedYet} onSyncRequested={handleSync} />;
}

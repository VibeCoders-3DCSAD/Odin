import { useSession } from "../../../../../features/auth/components/AccessProvider";
import BillersScreen from "../../../../../features/billers/BillersScreen";
import { useSync } from "../../../../../features/sync/SyncProvider";

// TODO(money routes): onAdd/onEdit open the biller form and onOpen the biller detail once they have routes.
const notRoutedYet = () => {};

export default function BillersRoute() {
  const { userId, deviceId } = useSession();
  const { syncVersion, handleSync } = useSync();
  return <BillersScreen userId={userId} deviceId={deviceId} syncVersion={syncVersion}
    onAdd={notRoutedYet} onEdit={notRoutedYet} onOpen={notRoutedYet} onSyncRequested={handleSync} />;
}

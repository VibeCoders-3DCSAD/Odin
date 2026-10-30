import { router } from "expo-router";
import { useSession } from "../../../../../features/auth/components/AccessProvider";
import BillersScreen from "../../../../../features/billers/BillersScreen";
import { billerEditHref, billerHref } from "../../../../../features/money/moneyRoutes";
import { useSync } from "../../../../../features/sync/SyncProvider";
import { ROUTES } from "../../../../../routes";

export default function BillersRoute() {
  const { userId, deviceId } = useSession();
  const { syncVersion, handleSync } = useSync();
  return <BillersScreen userId={userId} deviceId={deviceId} syncVersion={syncVersion}
    onAdd={() => router.push(ROUTES.billerNew)} onEdit={(id) => router.push(billerEditHref(id))} onOpen={(id) => router.push(billerHref(id))}
    onSyncRequested={handleSync} />;
}

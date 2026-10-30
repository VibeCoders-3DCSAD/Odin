import { router } from "expo-router";
import { useSession } from "../../../../../features/auth/components/AccessProvider";
import FinancialAccountsScreen from "../../../../../features/financial-accounts/FinancialAccountsScreen";
import { useSync } from "../../../../../features/sync/SyncProvider";
import { ROUTES } from "../../../../../routes";

export default function AccountsRoute() {
  const { userId, deviceId } = useSession();
  const { handleSync } = useSync();
  return <FinancialAccountsScreen userId={userId} deviceId={deviceId} onBack={() => router.navigate(ROUTES.dashboard)} onSyncRequested={handleSync} />;
}

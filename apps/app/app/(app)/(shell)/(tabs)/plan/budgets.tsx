import { router } from "expo-router";
import { useSession } from "../../../../../features/auth/components/AccessProvider";
import FinancialPlanScreen from "../../../../../features/financial-plan/FinancialPlanScreen";
import { useSync } from "../../../../../features/sync/SyncProvider";
import { ROUTES } from "../../../../../routes";

export default function BudgetsRoute() {
  const { accessToken, userId, deviceId } = useSession();
  const { syncVersion, handleSync } = useSync();
  return <FinancialPlanScreen userId={userId} deviceId={deviceId} accessToken={accessToken} syncVersion={syncVersion}
    onSyncRequested={handleSync} onOpenPastPlans={() => router.push(ROUTES.planPastPlans)} />;
}

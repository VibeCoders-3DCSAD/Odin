import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "../../../../../features/auth/components/AccessProvider";
import { transactionFormHref } from "../../../../../features/ledger/transactionFormRoute";
import { parseRouteId } from "../../../../../lib/routeParams";
import SavingsGoalsScreen from "../../../../../features/savings-goals/SavingsGoalsScreen";
import { useSync } from "../../../../../features/sync/SyncProvider";

// ?goalId= opens that goal (dashboard savings reminders); the screen only matches it against this user's goals.
export default function SavingsRoute() {
  const { userId, deviceId } = useSession();
  const { syncVersion } = useSync();
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();
  return <SavingsGoalsScreen userId={userId} deviceId={deviceId} syncVersion={syncVersion} initialGoalId={parseRouteId(goalId)}
    onRecordActivity={(savingsGoalId, activity, amountCentavos) => router.push(transactionFormHref({ kind: "savings-activity", savingsGoalId, activity, amountCentavos }))}
    onOpenTransaction={(transactionId) => router.push(transactionFormHref({ kind: "edit", transactionId }))} />;
}

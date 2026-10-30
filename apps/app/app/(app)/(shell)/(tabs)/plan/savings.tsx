import { useLocalSearchParams } from "expo-router";
import { useSession } from "../../../../../features/auth/components/AccessProvider";
import { parseRouteId } from "../../../../../lib/routeParams";
import SavingsGoalsScreen from "../../../../../features/savings-goals/SavingsGoalsScreen";
import { useSync } from "../../../../../features/sync/SyncProvider";

// TODO(plan routes): record a contribution/withdrawal and open a goal's transaction through transactionFormHref.
const notRoutedYet = () => {};

// ?goalId= opens that goal (dashboard savings reminders); the screen only matches it against this user's goals.
export default function SavingsRoute() {
  const { userId, deviceId } = useSession();
  const { syncVersion } = useSync();
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();
  return <SavingsGoalsScreen userId={userId} deviceId={deviceId} syncVersion={syncVersion} initialGoalId={parseRouteId(goalId)}
    onRecordActivity={notRoutedYet} onOpenTransaction={notRoutedYet} />;
}

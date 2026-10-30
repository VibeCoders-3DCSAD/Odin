import { router } from "expo-router";
import { useSession } from "../../../../features/auth/components/AccessProvider";
import TransactionHistoryScreen from "../../../../features/ledger/TransactionHistoryScreen";
import { useTransactionFormStore } from "../../../../features/ledger/stores/useTransactionFormStore";
import { useShellPage } from "../../../../features/shell/components/PageScroll";
import { TabPage } from "../../../../features/shell/components/TabPage";
import { useShellChromeStore } from "../../../../features/shell/stores/useShellChromeStore";
import { useSync } from "../../../../features/sync/SyncProvider";
import { ROUTES } from "../../../../routes";

function Activity() {
  const { accessToken, userId, deviceId } = useSession();
  const { syncVersion } = useSync();
  const { setLoadMore, getScrollY, scrollTo } = useShellPage();
  const unusualSpending = useTransactionFormStore((state) => state.pendingUnusualSpending);
  const dismissUnusualSpending = useTransactionFormStore((state) => state.dismissUnusualSpending);
  const setActivityEditing = useShellChromeStore((state) => state.setActivityEditing);
  return <TransactionHistoryScreen userId={userId} deviceId={deviceId} accessToken={accessToken}
    unusualSpending={unusualSpending} onUnusualSpendingDismissed={dismissUnusualSpending}
    onNewTransaction={() => router.push(ROUTES.transactionForm)} onLoadMoreChange={setLoadMore}
    getScrollOffset={getScrollY} scrollTo={scrollTo} syncVersion={syncVersion} onEditingChange={setActivityEditing} />;
}

// Activity edits in place, so the list stays mounted under the edit form while the chrome hides.
export default function ActivityRoute() {
  const editing = useShellChromeStore((state) => state.activityEditing);
  return <TabPage tab="activity" hideChrome={editing}><Activity /></TabPage>;
}

import { router, type Href } from "expo-router";
import { useSession } from "../../../../features/auth/components/AccessProvider";
import DashboardScreen from "../../../../features/dashboard/DashboardScreen";
import { dashboardLinkHref } from "../../../../features/dashboard/helpers/dashboardLinks";
import { reminderTargetHref } from "../../../../features/dashboard/helpers/reminderTargets";
import { TabPage } from "../../../../features/shell/components/TabPage";
import { useSync } from "../../../../features/sync/SyncProvider";

function open(href: Href | null) {
  if (href) router.navigate(href);
}

export default function DashboardRoute() {
  const { accessToken, userId, deviceId } = useSession();
  const { syncVersion } = useSync();
  return <TabPage tab="dashboard">
    <DashboardScreen userId={userId} deviceId={deviceId} accessToken={accessToken} syncVersion={syncVersion}
      onNavigate={(page) => open(dashboardLinkHref(page))} onOpenReminder={(target) => open(reminderTargetHref(target))} />
  </TabPage>;
}

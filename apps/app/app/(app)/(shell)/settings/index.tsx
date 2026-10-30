import { router } from "expo-router";
import { useSession } from "../../../../features/auth/components/AccessProvider";
import { useAuthStore } from "../../../../features/auth/stores/useAuthStore";
import SettingsScreen from "../../../../features/settings/SettingsScreen";
import { InnerPage } from "../../../../features/shell/components/InnerPage";
import { ROUTES } from "../../../../routes";

export default function SettingsRoute() {
  const { accessToken, userId, deviceId } = useSession();
  return <InnerPage title="Settings">
    <SettingsScreen accessToken={accessToken} userId={userId} deviceId={deviceId}
      onLock={() => { void useAuthStore.getState().lock(); }}
      onRequestReassessment={() => router.replace({ pathname: ROUTES.userOnboarding, params: { restart: "1" } })} />
  </InnerPage>;
}

import { router } from "expo-router";
import MobileShell from "../../components/MobileShell";
import { InitialSyncGate } from "../../features/sync/InitialSyncGate";
import { useSession } from "../../features/auth/components/AccessProvider";
import { signOutGoogle } from "../../features/auth/services/googleSignIn";
import { useAuthStore } from "../../features/auth/stores/useAuthStore";
import { ROUTES } from "../../Routes";

export default function Dashboard() {
  const { accessToken, userId, deviceId } = useSession();
  return <InitialSyncGate key={userId} accessToken={accessToken} userId={userId} deviceId={deviceId}>
    <MobileShell accessToken={accessToken} userId={userId} deviceId={deviceId}
      onLoggedOut={() => { void useAuthStore.getState().finishLogout(); }}
      onRequestReassessment={() => router.replace({ pathname: ROUTES.userOnboarding, params: { restart: "1" } })}
      onLock={() => { void useAuthStore.getState().lock(); }}
      signOut={signOutGoogle} />
  </InitialSyncGate>;
}

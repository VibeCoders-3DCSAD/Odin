import { useEffect, useState } from "react";
import "./global.css";

import { StatusBar } from "expo-status-bar";
import AuthExperience, { type AuthenticatedState } from "./components/AuthExperience";
import MobileShell from "./components/MobileShell";
import { ToastProvider } from "./components/Toast";
import { startConnectivityPolling } from "./services/connectivity";
import { useDeepLink } from "./hooks/useDeepLink";
import { getOrCreateDeviceId } from "./local-db/deviceId";

export default function App() {
  const [authenticated, setAuthenticated] = useState<AuthenticatedState | null>(null);
  const {
    isPasswordRecovery, isResolvingRecoveryToken, recoveryRefreshToken, recoveryToken,
    verificationToken,
  } = useDeepLink();
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => { getOrCreateDeviceId().then(setDeviceId).catch(() => {}); }, []);
  useEffect(() => { startConnectivityPolling(); }, []);

  return (
    <ToastProvider>
      {authenticated ? (
        <>
          <MobileShell
            accessToken={authenticated.accessToken}
            userId={authenticated.userId ?? ""}
            deviceId={deviceId}
            onLoggedOut={() => setAuthenticated(null)}
          />
          <StatusBar style="dark" />
        </>
      ) : (
        <>
          <AuthExperience
            google={{}}
            isPasswordRecovery={isPasswordRecovery}
            isResolvingRecoveryToken={isResolvingRecoveryToken}
            recoveryRefreshToken={recoveryRefreshToken ?? undefined}
            recoveryToken={recoveryToken ?? undefined}
            verificationToken={verificationToken ?? undefined}
            onAuthenticated={(state) => setAuthenticated(state)}
            onLoggedOut={() => setAuthenticated(null)}
          />
          <StatusBar style="dark" />
        </>
      )}
    </ToastProvider>
  );
}

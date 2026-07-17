import { useEffect, useState } from "react";
import "./global.css";

import { StatusBar } from "expo-status-bar";
import AuthExperience, { type AuthenticatedState } from "./components/AuthExperience";
import MobileShell from "./components/MobileShell";
import OnboardingFlow from "./features/onboarding/OnboardingFlow";
import { ToastProvider } from "./components/Toast";
import { startConnectivityPolling } from "./services/connectivity";
import { useDeepLink } from "./hooks/useDeepLink";
import { useRecurringEngineTrigger } from "./hooks/useRecurringEngineTrigger";
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
  useRecurringEngineTrigger(authenticated?.onboardingStatus === "submitted");

  const handleOnboardingComplete = () => {
    setAuthenticated((prev) =>
      prev ? { ...prev, onboardingStatus: "submitted" } : prev,
    );
  };

  return (
    <ToastProvider>
      {authenticated ? (
        authenticated.onboardingStatus === "submitted" ? (
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
            <OnboardingFlow
              accessToken={authenticated.accessToken}
              userId={authenticated.userId ?? ""}
              onComplete={handleOnboardingComplete}
            />
            <StatusBar style="dark" />
          </>
        )
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

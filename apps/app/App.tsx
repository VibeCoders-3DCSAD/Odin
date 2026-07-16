import { useEffect, useState } from "react";
import "./global.css";

import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthExperience, { type AuthenticatedState } from "./components/AuthExperience";
import DevBypassBanner from "./components/DevBypassBanner";
import MobileShell from "./components/MobileShell";
import OnboardingFlow from "./features/onboarding/OnboardingFlow";
import { ToastProvider } from "./components/Toast";
import { startConnectivityPolling } from "./services/connectivity";
import { useDeepLink } from "./hooks/useDeepLink";
import { useDevBypassBootstrap } from "./hooks/useDevBypassBootstrap";
import {
  createDevBypassSession,
  isDevAuthBypassEnabled,
} from "./lib/devBypass";

export default function App() {
  const { deviceId, retainSessionOnLogout } = useDevBypassBootstrap();
  const [authenticated, setAuthenticated] = useState<AuthenticatedState | null>(
    () => (isDevAuthBypassEnabled ? createDevBypassSession() : null),
  );
  const {
    isPasswordRecovery, isResolvingRecoveryToken, recoveryRefreshToken, recoveryToken,
    verificationToken,
  } = useDeepLink();

  useEffect(() => { startConnectivityPolling(); }, []);

  const handleOnboardingComplete = () => {
    setAuthenticated((prev) =>
      prev ? { ...prev, onboardingStatus: "submitted" } : prev,
    );
  };

  const handleLoggedOut = () => {
    if (retainSessionOnLogout(setAuthenticated)) return;
    setAuthenticated(null);
  };

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <View className="flex-1">
          <DevBypassBanner />
          {authenticated ? (
            authenticated.onboardingStatus === "submitted" ? (
              <>
                <MobileShell
                  accessToken={authenticated.accessToken}
                  userId={authenticated.userId ?? ""}
                  deviceId={deviceId}
                  onLoggedOut={handleLoggedOut}
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
                onLoggedOut={handleLoggedOut}
              />
              <StatusBar style="dark" />
            </>
          )}
        </View>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

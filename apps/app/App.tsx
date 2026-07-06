import { useState } from "react";
import "./global.css";

import { StatusBar } from "expo-status-bar";
import AuthExperience, { type AuthenticatedState } from "./components/AuthExperience";
import MobileShell from "./components/MobileShell";
import { useDeepLink } from "./hooks/useDeepLink";

export default function App() {
  const [authenticated, setAuthenticated] = useState<AuthenticatedState | null>(null);
  const {
    isPasswordRecovery, isResolvingRecoveryToken, recoveryRefreshToken, recoveryToken,
    isEmailVerification, isResolvingVerification, verificationToken, verificationRefreshToken,
  } = useDeepLink();

  if (authenticated) {
    return (
      <>
        <MobileShell
          accessToken={authenticated.accessToken}
          onLoggedOut={() => setAuthenticated(null)}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  return (
    <>
      <AuthExperience
        google={{}}
        isPasswordRecovery={isPasswordRecovery}
        isResolvingRecoveryToken={isResolvingRecoveryToken}
        recoveryRefreshToken={recoveryRefreshToken ?? undefined}
        recoveryToken={recoveryToken ?? undefined}
        isEmailVerification={isEmailVerification}
        isResolvingVerification={isResolvingVerification}
        verificationToken={verificationToken ?? undefined}
        verificationRefreshToken={verificationRefreshToken ?? undefined}
        onAuthenticated={(state) => setAuthenticated(state)}
        onLoggedOut={() => setAuthenticated(null)}
      />
      <StatusBar style="dark" />
    </>
  );
}

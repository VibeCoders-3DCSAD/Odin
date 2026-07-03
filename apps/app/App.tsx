import "./global.css";

import { StatusBar } from "expo-status-bar";
import AuthExperience from "./components/AuthExperience";
import { useDeepLink } from "./hooks/useDeepLink";

export default function App() {
  const { isPasswordRecovery, isResolvingRecoveryToken, recoveryRefreshToken, recoveryToken } = useDeepLink();

  return (
    <>
      <AuthExperience
        google={{}}
        isPasswordRecovery={isPasswordRecovery}
        isResolvingRecoveryToken={isResolvingRecoveryToken}
        recoveryRefreshToken={recoveryRefreshToken ?? undefined}
        recoveryToken={recoveryToken ?? undefined}
      />
      <StatusBar style="dark" />
    </>
  );
}

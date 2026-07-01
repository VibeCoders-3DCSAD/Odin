import "./global.css";

import { StatusBar } from "expo-status-bar";
import AuthExperience from "./components/AuthExperience";
import { useDeepLink } from "./hooks/useDeepLink";

export default function App() {
  const { recoveryToken } = useDeepLink();

  return (
    <>
      <AuthExperience
        google={{
          enabled: false,
          helperText: "Email and password are live here. Google sign-in stays on native dev builds for now.",
        }}
        recoveryToken={recoveryToken ?? undefined}
      />
      <StatusBar style="dark" />
    </>
  );
}

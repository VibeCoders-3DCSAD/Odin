import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useInitialSync } from "./hooks/useInitialSync";
import { InitialSyncScreen, initialSyncBackground } from "./InitialSyncScreen";

type Props = { userId: string; deviceId: string; accessToken: string; children: ReactNode };

// Holds the app shell back until a fresh account's server data has been paged onto this device.
export function InitialSyncGate({ userId, deviceId, accessToken, children }: Props) {
  const { status, progress, retry, skip } = useInitialSync(userId, deviceId, accessToken);

  if (status === "done") return <>{children}</>;
  if (status === "checking") {
    return <View style={{ backgroundColor: initialSyncBackground }} className="flex-1 items-center justify-center"><ActivityIndicator color="#013220" /></View>;
  }
  return <InitialSyncScreen progress={progress} failed={status === "failed"} onRetry={() => { void retry(); }} onSkip={skip} />;
}

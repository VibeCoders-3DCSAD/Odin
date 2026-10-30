import { createContext, useContext, type ReactNode } from "react";
import type { useDeepLink } from "../../../hooks/useDeepLink";
import { useAuthStore } from "../stores/useAuthStore";

type AccessValue = { deviceId: string; links: ReturnType<typeof useDeepLink> };

// Shares state the root layout owns with routes: one deep-link reader (auth codes are
// single-use, so it must not run twice) and the device id resolved after unlock.
const AccessContext = createContext<AccessValue | null>(null);

export function AccessProvider({ value, children }: { value: AccessValue; children: ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error("useAccess must be used inside AccessProvider.");
  return value;
}

// Routes in the (app) group only mount once unlocked, so the session is always present there.
export function useSession() {
  const { deviceId } = useAccess();
  const session = useAuthStore((state) => state.account?.session);
  if (!session || !deviceId) throw new Error("useSession must be used inside an unlocked route.");
  return { accessToken: session.accessToken, userId: session.userId, deviceId, onboardingStatus: session.onboardingStatus };
}

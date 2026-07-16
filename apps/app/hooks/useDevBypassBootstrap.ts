import { useEffect, useState } from "react";
import type { AuthenticatedState } from "../components/AuthExperience";
import {
  createDevBypassSession,
  DEV_BYPASS_DEVICE_ID,
  isDevAuthBypassEnabled,
} from "../lib/devBypass";
import { getOrCreateDeviceId } from "../local-db/deviceId";

/**
 * Shared local-preview bootstrap for App.tsx / App.native.tsx.
 * Inactive unless __DEV__ and EXPO_PUBLIC_DEV_BYPASS_AUTH=true.
 */
export function useDevBypassBootstrap() {
  const [deviceId, setDeviceId] = useState(
    isDevAuthBypassEnabled ? DEV_BYPASS_DEVICE_ID : "",
  );

  useEffect(() => {
    if (isDevAuthBypassEnabled) {
      setDeviceId(DEV_BYPASS_DEVICE_ID);
      return;
    }
    getOrCreateDeviceId().then(setDeviceId).catch(() => {});
  }, []);

  function retainSessionOnLogout(
    setAuthenticated: (state: AuthenticatedState | null) => void,
  ): boolean {
    if (!isDevAuthBypassEnabled) return false;
    setAuthenticated(createDevBypassSession());
    return true;
  }

  return {
    deviceId,
    skipSessionRestore: isDevAuthBypassEnabled,
    retainSessionOnLogout,
  };
}

import { createContext, useContext, useState, type ReactNode } from "react";
import { View } from "react-native";
import { DeletionSuccessOverlay } from "./components/DeletionSuccessOverlay";
import { SyncIssuesSheet } from "./components/SyncIssuesSheet";
import { useLogoutFlow } from "./hooks/useLogoutFlow";
import { useSyncEngine } from "./hooks/useSyncEngine";
import { useSyncIssues } from "./hooks/useSyncIssues";
import { countExhaustedSyncRows } from "./services/syncQueue";

export type SyncValue = {
  syncing: boolean;
  queueCount: number;
  // Bumped whenever a sync or local queue change may have changed stored data; pass it to screens as a reload key.
  syncVersion: number;
  syncMessage: string | null;
  // Manual sync; opens the sync-issues sheet instead when changes have run out of attempts.
  handleSync: () => Promise<void>;
};

export type LogoutValue = {
  online: boolean;
  isLoggingOut: boolean;
  logoutError: string | null;
  confirmLogout: () => void;
  handleLogout: () => Promise<void>;
  // Shows the full-shell "Deletion requested" screen, whose only action logs out.
  showDeletionSuccess: (scheduledDate: string) => void;
};

const SyncContext = createContext<SyncValue | null>(null);
const LogoutContext = createContext<LogoutValue | null>(null);

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onLoggedOut: () => void;
  signOut?: () => Promise<void>;
  children: ReactNode;
};

export function SyncProvider({ userId, deviceId, accessToken, onLoggedOut, signOut, children }: Props) {
  const engine = useSyncEngine({ userId, deviceId, accessToken });
  const issues = useSyncIssues({ userId, deviceId, engine });
  const logout = useLogoutFlow({ userId, deviceId, accessToken, engine, issues, onLoggedOut, signOut });
  const [deletionDate, setDeletionDate] = useState<string | null>(null);

  async function handleSync() {
    if (await countExhaustedSyncRows(userId, deviceId) > 0) {
      await issues.open(true);
      return;
    }

    await engine.syncNow(true);
  }

  const sync: SyncValue = { syncing: engine.syncing, queueCount: engine.queueCount, syncVersion: engine.syncVersion, syncMessage: engine.syncMessage, handleSync };
  const logoutValue: LogoutValue = {
    online: logout.online, isLoggingOut: logout.isLoggingOut, logoutError: logout.logoutError,
    confirmLogout: logout.confirmLogout, handleLogout: logout.handleLogout, showDeletionSuccess: setDeletionDate,
  };

  return <SyncContext.Provider value={sync}><LogoutContext.Provider value={logoutValue}>
    <View className="flex-1">
      {children}
      {deletionDate ? <DeletionSuccessOverlay scheduledDate={deletionDate} onBackToLogin={() => { void logout.handleLogout(); }} /> : null}
      <SyncIssuesSheet issues={issues} isLoggingOut={logout.isLoggingOut} onConfirmDiscard={() => { void logout.discardFailedChanges(); }} />
    </View>
  </LogoutContext.Provider></SyncContext.Provider>;
}

export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync must be used inside SyncProvider.");
  return value;
}

export function useLogout() {
  const value = useContext(LogoutContext);
  if (!value) throw new Error("useLogout must be used inside SyncProvider.");
  return value;
}

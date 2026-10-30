import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { initDatabase } from "../../../local-db/client";
import { cleanupDiscardedSyncRows } from "../../../local-db/helpers";
import { postDueRecurringIncome } from "../../../local-db/repositories/recurringIncome";
import { postDueScheduledPayments } from "../../../local-db/repositories/scheduledPayments";
import { runSync } from "../../../local-db/sync/runSync";
import { isOnline } from "../../../lib/network";
import { installSyncDevTools } from "../services/devTools";
import { countQueuedSyncRows, countRetryableSyncRows } from "../services/syncQueue";

const SYNC_STATUS_POLL_MS = 5_000;
const AUTO_SYNC_MS = 30_000;

type Session = { userId: string; deviceId: string; accessToken: string };

// Background sync for the signed-in shell: posts due bills and paydays, syncs on launch and
// foreground, polls the queue, and bumps syncVersion whenever synced data may have changed.
export function useSyncEngine({ userId, deviceId, accessToken }: Session) {
  const [syncing, setSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [syncPending, setSyncPending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const initialSyncDone = useRef(false);
  const wasOnline = useRef(false);
  const syncInFlight = useRef(false);
  const lastAutoSyncAt = useRef(0);
  const lastObservedQueueCount = useRef<number | null>(null);
  const syncMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!__DEV__) return;
    installSyncDevTools(userId, deviceId, refreshQueueCount);
  }, [deviceId, userId]);

  useEffect(() => {
    initDatabase()
      .then(cleanupDiscardedSyncRows)
      .catch(() => {});
  }, []);

  function clearSyncMessageSoon() {
    if (syncMessageTimer.current) clearTimeout(syncMessageTimer.current);
    syncMessageTimer.current = setTimeout(() => setSyncMessage(null), 4000);
  }

  // Cycles through messages every 3s until the returned stop function runs.
  function startRotatingMessages(messages: readonly string[]) {
    if (syncMessageTimer.current) clearTimeout(syncMessageTimer.current);

    let index = 0;
    const firstMessage = messages[0]!;
    setSyncMessage(messages[index] ?? firstMessage);
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setSyncMessage(messages[index] ?? firstMessage);
    }, 3_000);

    return () => {
      clearInterval(interval);
      setSyncMessage(null);
    };
  }

  async function refreshQueueCount() {
    const count = await countQueuedSyncRows(userId, deviceId);
    if (lastObservedQueueCount.current !== null && lastObservedQueueCount.current !== count) {
      setSyncVersion((value) => value + 1);
    }
    lastObservedQueueCount.current = count;
    setQueueCount(count);
    return count;
  }

  async function syncNow(showMessage: boolean) {
    if (syncInFlight.current || !userId || !deviceId || !accessToken) return null;

    syncInFlight.current = true;
    setSyncing(true);
    if (showMessage) setSyncMessage(null);

    try {
      const online = await isOnline();
      if (!online) {
        if (showMessage) {
          setSyncMessage("No internet connection");
          clearSyncMessageSoon();
        }
        return null;
      }

      lastAutoSyncAt.current = Date.now();
      const result = await runSync(userId, deviceId, accessToken);
      await refreshQueueCount();
      setSyncPending(result.hasMore);

      // A pushed local mutation changes the inputs of an unaccepted plan too.
      if (result.pulled > 0 || result.pushed > 0) setSyncVersion((value) => value + 1);

      if (showMessage && result.errors > 0) {
        setSyncMessage(`${result.errors} item(s) could not be synced`);
        clearSyncMessageSoon();
      }
      return result;
    } catch {
      if (showMessage) {
        setSyncMessage("Sync failed");
        clearSyncMessageSoon();
      }
      return null;
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }

  async function tickSyncStatus() {
    if (!userId || !deviceId || !accessToken) return;

    await refreshQueueCount();
    const retryable = await countRetryableSyncRows(userId, deviceId);
    const online = await isOnline();
    const reconnected = online && !wasOnline.current;
    const autoSyncDue = Date.now() - lastAutoSyncAt.current >= AUTO_SYNC_MS;

    if (online && (syncPending || (retryable > 0 && (reconnected || autoSyncDue)))) {
      await syncNow(false);
    }

    wasOnline.current = online;
  }

  useEffect(() => {
    if (!userId || !deviceId || !accessToken) return;

    // Due bills and paydays are posted first so they go out with this sync. The server posts them too;
    // matching ids make whichever arrives second a no-op.
    const sync = () => {
      Promise.allSettled([
        postDueScheduledPayments(userId, deviceId).catch((error) => { console.warn("[SCHEDULED-PAYMENTS] auto-post failed", error); }),
        postDueRecurringIncome(userId, deviceId).catch((error) => { console.warn("[RECURRING-INCOME] auto-post failed", error); }),
      ]).finally(() => { syncNow(false).catch(() => {}); });
    };

    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      sync();
    }

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });

    return () => {
      sub.remove();
      if (syncMessageTimer.current) clearTimeout(syncMessageTimer.current);
    };
  }, [userId, deviceId, accessToken]);

  useEffect(() => {
    if (!userId || !deviceId || !accessToken) return;

    tickSyncStatus().catch(() => {});
    const interval = setInterval(() => { tickSyncStatus().catch(() => {}); }, SYNC_STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [userId, deviceId, accessToken, syncPending]);

  return { syncing, syncVersion, syncMessage, queueCount, setQueueCount, refreshQueueCount, syncNow, startRotatingMessages };
}

export type SyncEngine = ReturnType<typeof useSyncEngine>;

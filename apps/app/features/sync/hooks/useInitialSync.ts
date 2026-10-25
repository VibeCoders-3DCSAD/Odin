import { useCallback, useEffect, useState } from "react";
import { needsInitialSync } from "../../../local-db/sync/initialSync";
import { runSync, type PullProgress } from "../../../local-db/sync/runSync";

export type InitialSyncStatus = "checking" | "syncing" | "failed" | "done";

export function useInitialSync(userId: string, deviceId: string, accessToken: string) {
  const [status, setStatus] = useState<InitialSyncStatus>("checking");
  const [progress, setProgress] = useState<PullProgress>({ received: 0, total: 0 });

  const start = useCallback(async () => {
    setStatus("syncing");
    try {
      const result = await runSync(userId, deviceId, accessToken, { untilComplete: true, onProgress: setProgress });
      setStatus(result.hasMore ? "failed" : "done");
    } catch {
      setStatus("failed");
    }
  }, [userId, deviceId, accessToken]);

  useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    needsInitialSync(userId)
      .then((needed) => {
        if (cancelled) return;
        if (needed) void start();
        else setStatus("done");
      })
      .catch(() => { if (!cancelled) setStatus("done"); });
    return () => { cancelled = true; };
    // Re-check only when the account changes; a refreshed token must not restart the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { status, progress, retry: start, skip: () => setStatus("done") };
}

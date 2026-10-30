import { useState } from "react";
import { discardSyncIssue, loadSyncIssuesPage, retrySyncIssue, type SyncQueueIssue } from "../services/syncQueue";
import type { SyncEngine } from "./useSyncEngine";

type Options = { userId: string; deviceId: string; engine: Pick<SyncEngine, "refreshQueueCount" | "setQueueCount"> };

// State behind the "Unsynced changes" sheet: changes that ran out of sync attempts, paged 50 at a time.
export function useSyncIssues({ userId, deviceId, engine }: Options) {
  const [visible, setVisible] = useState(false);
  const [issues, setIssues] = useState<SyncQueueIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [failedTotal, setFailedTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [allowDiscard, setAllowDiscard] = useState(false);
  const [logoutAfterDiscard, setLogoutAfterDiscard] = useState(false);
  const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);

  async function load(offset = 0) {
    const page = await loadSyncIssuesPage(userId, deviceId, offset);
    setTotal(page.total);
    setFailedTotal(page.failedTotal);
    setPendingTotal(page.pendingTotal);
    engine.setQueueCount(page.total);
    setIssues((current) => offset === 0 ? page.rows : [...current, ...page.rows]);
    return page.rows;
  }

  async function loadMore() {
    if (loading || issues.length >= total) return;
    setLoading(true);
    try {
      await load(issues.length);
    } finally {
      setLoading(false);
    }
  }

  async function open(canDiscard = false, shouldLogoutAfterDiscard = false) {
    setLoading(true);
    await load();
    setLoading(false);
    setAllowDiscard(canDiscard);
    setLogoutAfterDiscard(shouldLogoutAfterDiscard);
    setVisible(true);
  }

  async function discardOne(operationId: string) {
    await discardSyncIssue(userId, operationId);
    await engine.refreshQueueCount();
    setIssues((prev) => prev.filter((issue) => issue.operation_id !== operationId));
    setTotal((prev) => prev - 1);
    const issue = issues.find((item) => item.operation_id === operationId);
    if (issue?.status === "failed") setFailedTotal((prev) => prev - 1);
    else setPendingTotal((prev) => prev - 1);
  }

  async function retryOne(operationId: string) {
    await retrySyncIssue(userId, operationId);
    await load();
  }

  // After every exhausted change is discarded the sheet closes with nothing left to show.
  function clear() {
    setDiscardConfirmVisible(false);
    setVisible(false);
    setIssues([]);
    setTotal(0);
    setFailedTotal(0);
    setPendingTotal(0);
    setAllowDiscard(false);
    setLogoutAfterDiscard(false);
  }

  return {
    visible, issues, total, failedTotal, pendingTotal, loading, allowDiscard, logoutAfterDiscard, discardConfirmVisible,
    close: () => setVisible(false), setDiscardConfirmVisible, load, loadMore, open, discardOne, retryOne, clear,
  };
}

export type SyncIssues = ReturnType<typeof useSyncIssues>;

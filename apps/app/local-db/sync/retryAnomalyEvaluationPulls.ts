import type * as SQLite from "expo-sqlite";
import { applyPullRow, normalizePullRow } from "./pullConvergence";

type FailedPull = { record_id: string; payload: string };

// Older builds quarantined these rows because the remote IQR fields use different names.
// Their pull cursor has already advanced, so replay the saved payload after fixing the mapping.
export async function retryAnomalyEvaluationPulls(db: SQLite.SQLiteDatabase, userId: string): Promise<number> {
  const failures = await db.getAllAsync<FailedPull>(
    "SELECT record_id, payload FROM sync_pull_failures WHERE user_id = ? AND table_name = 'anomaly_evaluations' ORDER BY updated_at, record_id LIMIT 500",
    userId,
  );
  let applied = 0;
  for (const failure of failures) {
    try {
      const payload: unknown = JSON.parse(failure.payload);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
      const row = payload as Record<string, unknown>;
      if (row.user_id !== userId || row.id !== failure.record_id) continue;
      await applyPullRow(db, "anomaly_evaluations", normalizePullRow("anomaly_evaluations", row, userId));
      await db.runAsync(
        "DELETE FROM sync_pull_failures WHERE user_id = ? AND table_name = 'anomaly_evaluations' AND record_id = ?",
        userId, failure.record_id,
      );
      applied++;
    } catch {
      // Keep failed rows quarantined; they must not block the rest of synchronization.
    }
  }
  return applied;
}

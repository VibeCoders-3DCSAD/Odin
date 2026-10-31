import { initDatabase } from "../../client";
import { randomUUID } from "../../uuid";
import type { QuarterlyForecastPayload } from "../../../features/forecast/types";

// Runs kept per month; older runs from the same month are deleted.
export const FORECAST_SNAPSHOTS_PER_MONTH = 5;

// runMonth is the Manila month (YYYY-MM) the forecast ran in.
export async function saveForecastSnapshot(userId: string, runMonth: string, payload: QuarterlyForecastPayload, now = new Date()): Promise<void> {
  const db = await initDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO forecast_snapshots (id, user_id, run_month, generated_at, payload_json) VALUES (?, ?, ?, ?, ?)",
      randomUUID(), userId, runMonth, now.toISOString(), JSON.stringify(payload),
    );
    await db.runAsync(
      `DELETE FROM forecast_snapshots
        WHERE user_id = ? AND run_month = ? AND id NOT IN (
          SELECT id FROM forecast_snapshots WHERE user_id = ? AND run_month = ?
           ORDER BY generated_at DESC, rowid DESC LIMIT ?)`,
      userId, runMonth, userId, runMonth, FORECAST_SNAPSHOTS_PER_MONTH,
    );
  });
}

// The latest forecast run during runMonth, or null when none was saved.
export async function getLatestForecastSnapshot(userId: string, runMonth: string): Promise<QuarterlyForecastPayload | null> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{ payload_json: string }>(
    "SELECT payload_json FROM forecast_snapshots WHERE user_id = ? AND run_month = ? ORDER BY generated_at DESC, rowid DESC LIMIT 1",
    userId, runMonth,
  );
  return row ? JSON.parse(row.payload_json) as QuarterlyForecastPayload : null;
}

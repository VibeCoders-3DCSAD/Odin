import { jest } from "@jest/globals";
import { createSqliteHarness } from "./sqliteHarness";
import forecastSnapshotsMigration from "../../migrations/090_forecast_snapshots";
import type { QuarterlyForecastPayload } from "../../../features/forecast/types";

const mockHarness = createSqliteHarness();
let mockNextId = 0;

jest.mock("../../client", () => ({ initDatabase: async () => mockHarness.db }));
jest.mock("../../uuid", () => ({ randomUUID: () => `snapshot-${++mockNextId}` }));

const { getLatestForecastSnapshot, saveForecastSnapshot } = jest.requireActual<typeof import("../forecastSnapshots")>("../forecastSnapshots");

function payload(totalCentavos: number): QuarterlyForecastPayload {
  return { quarters: [], months: [{ month: "2026-09", totalCentavos, categories: [] }], modelVersion: "v4", generatedAt: "2026-09-01T00:00:00.000Z" };
}

beforeAll(async () => { await mockHarness.migrate(forecastSnapshotsMigration); });

it("saves every run and keeps only a month's five latest", async () => {
  for (let day = 1; day <= 7; day++) await saveForecastSnapshot("user-1", "2026-09", payload(day), new Date(`2026-09-0${day}T00:00:00.000Z`));
  await saveForecastSnapshot("user-1", "2026-10", payload(100), new Date("2026-10-01T00:00:00.000Z"));
  await saveForecastSnapshot("user-2", "2026-09", payload(200), new Date("2026-09-01T00:00:00.000Z"));

  const kept = mockHarness.sqlite.prepare("SELECT user_id, run_month, generated_at FROM forecast_snapshots ORDER BY user_id, generated_at").all();
  expect(kept.filter((row) => row.user_id === "user-1" && row.run_month === "2026-09").map((row) => String(row.generated_at).slice(0, 10)))
    .toEqual(["2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"]);
  expect(kept).toHaveLength(7);
  expect((await getLatestForecastSnapshot("user-1", "2026-09"))?.months?.[0]?.totalCentavos).toBe(7);
  expect(await getLatestForecastSnapshot("user-1", "2026-08")).toBeNull();
});

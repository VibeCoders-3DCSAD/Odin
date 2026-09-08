import type { DashboardSnapshotWithMeta } from "../../local-db/repositories/dashboardSnapshots";
import type { ForecastHorizon, ForecastLevel, ForecastPayload } from "../forecast/types";

type BudgetItem = { label: string; spent: number; budget: number };
type BudgetStatus = "on_track" | "warning" | "critical" | "unknown";

export type ForecastContent = ForecastPayload;

function payload(snapshot: DashboardSnapshotWithMeta | null | undefined): Record<string, unknown> {
  if (!snapshot) return {};
  try {
    const value: unknown = JSON.parse(snapshot.payload_json);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function getSnapshotText(snapshot: DashboardSnapshotWithMeta | null | undefined): string | null {
  const value = payload(snapshot);
  for (const key of ["text", "summary", "message"] as const) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key];
  }
  return null;
}

export function getSnapshotCount(snapshot: DashboardSnapshotWithMeta | null | undefined): number | null {
  const value = payload(snapshot);
  for (const key of ["count", "activeCount", "goalCount"] as const) {
    if (typeof value[key] === "number" && Number.isFinite(value[key])) return value[key];
  }
  return null;
}

export function getSnapshotCentavos(snapshot: DashboardSnapshotWithMeta | null | undefined, keys: string[]): number | null {
  const value = payload(snapshot);
  for (const key of keys) if (typeof value[key] === "number" && Number.isFinite(value[key])) return value[key];
  return null;
}

export function getBudgetContent(snapshot: DashboardSnapshotWithMeta | null | undefined): { items: BudgetItem[]; status: BudgetStatus } {
  const value = payload(snapshot);
  const items = Array.isArray(value.items) ? value.items.filter((item): item is BudgetItem => !!item && typeof item === "object" && typeof item.label === "string" && typeof item.spent === "number" && Number.isFinite(item.spent) && typeof item.budget === "number" && Number.isFinite(item.budget)) : [];
  const status = value.status === "on_track" || value.status === "warning" || value.status === "critical" ? value.status : "unknown";
  const start = value.period_start ?? value.periodStart;
  const end = value.period_end ?? value.periodEnd;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return typeof start !== "string" || typeof end !== "string" || (start <= today && end >= today) ? { items, status } : { items: [], status: "unknown" };
}

function isHorizon(value: unknown): value is ForecastHorizon {
  return value === "WEEKLY" || value === "SEMI_MONTHLY" || value === "MONTHLY" || value === "YEARLY";
}

function isLevel(value: unknown): value is ForecastLevel {
  return value === "TOTAL" || value === "CATEGORY_GROUP";
}

export function getForecastContent(snapshot: DashboardSnapshotWithMeta | null | undefined): ForecastContent | null {
  const value = payload(snapshot);
  if (!isHorizon(value.forecastHorizon) || !isLevel(value.forecastLevel) || typeof value.modelVersion !== "string" || (value.status !== "SUCCESS" && value.status !== "FALLBACK")) return null;
  const interval = value.confidenceInterval;
  if (!interval || typeof interval !== "object" || Array.isArray(interval)) return null;
  const bounds = interval as Record<string, unknown>;
  const numbers = [bounds.lower80Centavos, bounds.upper80Centavos, bounds.lower95Centavos, bounds.upper95Centavos];
  if (!numbers.every((number) => typeof number === "number" && Number.isFinite(number))) return null;
  const forecasts = Array.isArray(value.forecasts) ? value.forecasts.flatMap((point) => {
    if (!point || typeof point !== "object" || Array.isArray(point)) return [];
    const row = point as Record<string, unknown>;
    if (typeof row.date !== "string" || typeof row.amountCentavos !== "number" || !Number.isFinite(row.amountCentavos) || (row.category !== null && typeof row.category !== "string")) return [];
    return [{ date: row.date, amountCentavos: row.amountCentavos, category: row.category ?? null }];
  }) : [];
  return { forecasts, forecastHorizon: value.forecastHorizon, forecastLevel: value.forecastLevel, confidenceInterval: { lower80Centavos: bounds.lower80Centavos as number, upper80Centavos: bounds.upper80Centavos as number, lower95Centavos: bounds.lower95Centavos as number, upper95Centavos: bounds.upper95Centavos as number }, modelVersion: value.modelVersion, status: value.status };
}

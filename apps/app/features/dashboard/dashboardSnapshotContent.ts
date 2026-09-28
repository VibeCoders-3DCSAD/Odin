import type { DashboardSnapshotWithMeta } from "../../local-db/repositories/dashboardSnapshots";
import type { ForecastPayload } from "../forecast/types";

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

export function getForecastContent(snapshot: DashboardSnapshotWithMeta | null | undefined): ForecastContent | null {
  const value = payload(snapshot);
  if (typeof value.modelVersion !== "string" || value.status !== "SUCCESS") return null;
  const forecasts = Array.isArray(value.forecasts) ? value.forecasts.flatMap((point) => {
    if (!point || typeof point !== "object" || Array.isArray(point)) return [];
    const row = point as Record<string, unknown>;
    if (typeof row.category !== "string" || typeof row.month !== "string" || !/^\d{4}-\d{2}$/.test(row.month) || typeof row.quarter !== "string" || !/^\d{4}Q[1-4]$/.test(row.quarter) || typeof row.amountCentavos !== "number" || !Number.isFinite(row.amountCentavos) || typeof row.userBaselineCentavos !== "number" || !Number.isFinite(row.userBaselineCentavos) || typeof row.hfceMultiplier !== "number" || !Number.isFinite(row.hfceMultiplier) || typeof row.hfceForecastAmountMillionPhp !== "number" || !Number.isFinite(row.hfceForecastAmountMillionPhp) || typeof row.explanation !== "string") return [];
    return [{ category: row.category, month: row.month, quarter: row.quarter, amountCentavos: row.amountCentavos, userBaselineCentavos: row.userBaselineCentavos, hfceMultiplier: row.hfceMultiplier, hfceForecastAmountMillionPhp: row.hfceForecastAmountMillionPhp, explanation: row.explanation }];
  }) : [];
  return { forecasts, modelVersion: value.modelVersion, status: "SUCCESS" };
}

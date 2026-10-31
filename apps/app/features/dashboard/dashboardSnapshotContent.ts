import type { DashboardSnapshotWithMeta } from "../../local-db/repositories/dashboard/dashboardSnapshots";
import type { ForecastPayload, QuarterlyForecastPayload } from "../forecast/types";


export type ForecastContent = Omit<ForecastPayload, "snapshot">;

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

export function getQuarterlyForecastContent(snapshot: DashboardSnapshotWithMeta | null | undefined): QuarterlyForecastPayload | null {
  const value = payload(snapshot);
  if (typeof value.modelVersion !== "string" || typeof value.generatedAt !== "string" || !Array.isArray(value.quarters)) return null;
  const periods = (rows: unknown[], key: "quarter" | "month", pattern: RegExp) => rows.flatMap((period) => {
    if (!period || typeof period !== "object" || Array.isArray(period)) return [];
    const row = period as Record<string, unknown>;
    const id = row[key];
    if (typeof id !== "string" || !pattern.test(id) || typeof row.totalCentavos !== "number" || !Number.isFinite(row.totalCentavos) || !Array.isArray(row.categories)) return [];
    const categories = row.categories.flatMap((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point)) return [];
      const item = point as Record<string, unknown>;
      return typeof item.category === "string" && typeof item.amountCentavos === "number" && Number.isFinite(item.amountCentavos) ? [{ category: item.category, amountCentavos: item.amountCentavos }] : [];
    });
    return [{ id, totalCentavos: row.totalCentavos, categories }];
  });
  const quarters = periods(value.quarters, "quarter", /^\d{4}Q[1-4]$/).map(({ id, ...period }) => ({ quarter: id, ...period }));
  const months = Array.isArray(value.months) ? periods(value.months, "month", /^\d{4}-(0[1-9]|1[0-2])$/).map(({ id, ...period }) => ({ month: id, ...period })) : [];
  const interpretation = Array.isArray(value.interpretation) ? value.interpretation.filter((note): note is string => typeof note === "string" && note.trim().length > 0) : [];
  if (!quarters.length) return null;
  const quality = ["PERSONALIZED", "FALLBACK", "COLD_START", "INSUFFICIENT_DATA"].includes(value.quality as string) ? value.quality as QuarterlyForecastPayload["quality"] : undefined;
  const baselineMethod = ["same_period_last_year", "median_monthly", "recency_weighted_provisional"].includes(value.baselineMethod as string) ? value.baselineMethod as QuarterlyForecastPayload["baselineMethod"] : undefined;
  return {
    quarters, modelVersion: value.modelVersion, generatedAt: value.generatedAt,
    ...(months.length ? { months } : {}),
    ...(quality ? { quality } : {}), ...(baselineMethod ? { baselineMethod } : {}),
    ...(typeof value.seasonalUncertainty === "boolean" ? { seasonalUncertainty: value.seasonalUncertainty } : {}),
    ...(interpretation.length ? { interpretation } : {}),
  };
}

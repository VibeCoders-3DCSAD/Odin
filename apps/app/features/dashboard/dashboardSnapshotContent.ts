import type { DashboardSnapshotWithMeta } from "../../local-db/repositories/dashboardSnapshots";

type BudgetItem = { label: string; spent: number; budget: number };
type BudgetStatus = "on_track" | "warning" | "critical" | "unknown";

export type ForecastContent = {
  text: string | null;
  projectedBalanceCentavos: number | null;
  period: string | null;
  insights: string[];
  incomeCentavos: number | null;
  expenseCentavos: number | null;
  categories: { label: string; amountCentavos: number }[];
  events: { label: string; date: string | null }[];
  freshness: string | null;
  confidence: string | null;
};

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
  for (const key of ["count", "activeCount", "goalCount", "debtCount"] as const) {
    if (typeof value[key] === "number" && Number.isFinite(value[key])) return value[key];
  }
  return null;
}

export function getSnapshotCentavos(snapshot: DashboardSnapshotWithMeta | null | undefined, keys: string[]): number | null {
  const value = payload(snapshot);
  for (const key of keys) {
    if (typeof value[key] === "number" && Number.isFinite(value[key])) return value[key];
  }
  return null;
}

export function getBudgetContent(snapshot: DashboardSnapshotWithMeta | null | undefined): { items: BudgetItem[]; status: BudgetStatus } {
  const value = payload(snapshot);
  const items = Array.isArray(value.items)
    ? value.items.filter((item): item is BudgetItem => !!item && typeof item === "object" && typeof item.label === "string" && typeof item.spent === "number" && Number.isFinite(item.spent) && typeof item.budget === "number" && Number.isFinite(item.budget))
    : [];
  const status = value.status === "on_track" || value.status === "warning" || value.status === "critical" ? value.status : "unknown";
  const start = value.period_start ?? value.periodStart;
  const end = value.period_end ?? value.periodEnd;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const current = typeof start !== "string" || typeof end !== "string" || (start <= today && end >= today);
  return current ? { items, status } : { items: [], status: "unknown" };
}

export function getForecastContent(snapshot: DashboardSnapshotWithMeta | null | undefined): ForecastContent {
  const value = payload(snapshot);
  const projectedBalanceCentavos = typeof value.projected_balance_centavos === "number"
    ? value.projected_balance_centavos
    : typeof value.projectedBalanceCentavos === "number"
      ? value.projectedBalanceCentavos
      : null;
  const period = typeof value.period === "string" ? value.period : null;
  const insights = Array.isArray(value.insights) ? value.insights.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3) : [];
  const amount = (key: string): number | null => typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] : null;
  const categories = Array.isArray(value.categories)
    ? value.categories.filter((item): item is Record<string, unknown> => !!item && typeof item === "object").map((item) => ({ label: typeof item.label === "string" ? item.label : "Other", amountCentavos: typeof item.amount_centavos === "number" && Number.isFinite(item.amount_centavos) ? item.amount_centavos : typeof item.amountCentavos === "number" && Number.isFinite(item.amountCentavos) ? item.amountCentavos : 0 })).filter((item) => item.amountCentavos > 0).slice(0, 4)
    : [];
  const events = Array.isArray(value.expected_events)
    ? value.expected_events.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && typeof item.label === "string").map((item) => ({ label: item.label as string, date: typeof item.date === "string" ? item.date : null })).slice(0, 3)
    : [];
  return { text: getSnapshotText(snapshot), projectedBalanceCentavos, period, insights, incomeCentavos: amount("income_centavos"), expenseCentavos: amount("expense_centavos"), categories, events, freshness: typeof value.freshness === "string" ? value.freshness : null, confidence: typeof value.confidence === "string" ? value.confidence : null };
}

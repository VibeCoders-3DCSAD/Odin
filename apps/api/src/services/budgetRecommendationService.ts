import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const PERIOD_KINDS = ["WEEKLY", "MONTHLY", "CUSTOM", "INCOME_CYCLE"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ALLOCATIONS = 100;
const MAX_TRANSACTIONS = 500;
const MAX_FORECAST_POINTS = 500;
const MAX_TEXT_LENGTH = 160;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BudgetRecommendationRequest = {
  periodKind: (typeof PERIOD_KINDS)[number];
  periodStart: string;
  periodEnd: string;
  totalAmountMinor: number;
  debtBudgetAmountMinor: number;
  savingsBudgetAmountMinor: number;
  allocations: BudgetRecommendationTarget[];
  historicalTransactions?: BudgetRecommendationTransaction[];
  forecast?: BudgetRecommendationForecast;
};

export type BudgetRecommendationTarget = {
  categoryId: string | null;
  subcategoryId: string | null;
  preferredAmountMinor: number;
};

export type BudgetRecommendationTransaction = {
  transactionId: string;
  date: string;
  amount: number;
  category: string;
  transactionType: "income" | "expense";
};

export type BudgetRecommendationForecast = {
  version: 1;
  forecasts: Array<{ date: string; amountMinor: number; category: string | null }>;
  forecastHorizon: "MONTHLY";
  forecastLevel: "CATEGORY_GROUP";
  confidenceInterval: {
    lower80Minor: number;
    upper80Minor: number;
    lower95Minor: number;
    upper95Minor: number;
  };
  status: "SUCCESS" | "FALLBACK";
};

export type BudgetRecommendationPayload = {
  availableFundsMinor: number;
  debtBudgetAmountMinor: number;
  savingsBudgetAmountMinor: number;
  allocations: Array<BudgetRecommendationTarget & { amountMinor: number }>;
};

type MlBudgetResponse = {
  recommendation?: { allocations?: Array<{ category_id?: unknown; amount?: unknown }> };
};

export class BudgetRecommendationValidationError extends Error {}
export class BudgetRecommendationUpstreamError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function parseBudgetRecommendationRequest(value: unknown): BudgetRecommendationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BudgetRecommendationValidationError("request must be an object");
  const input = value as Record<string, unknown>;
  if (!(PERIOD_KINDS as readonly unknown[]).includes(input.periodKind)) throw new BudgetRecommendationValidationError("periodKind is invalid");
  const periodStart = parseDate(input.periodStart, "periodStart");
  const periodEnd = parseDate(input.periodEnd, "periodEnd");
  if (periodEnd < periodStart) throw new BudgetRecommendationValidationError("periodEnd must not precede periodStart");
  const totalAmountMinor = parsePositiveInteger(input.totalAmountMinor, "totalAmountMinor");
  const debtBudgetAmountMinor = parseNonNegativeInteger(input.debtBudgetAmountMinor, "debtBudgetAmountMinor");
  const savingsBudgetAmountMinor = parseNonNegativeInteger(input.savingsBudgetAmountMinor, "savingsBudgetAmountMinor");
  if (debtBudgetAmountMinor + savingsBudgetAmountMinor >= totalAmountMinor) throw new BudgetRecommendationValidationError("available funds must be positive");
  if (!Array.isArray(input.allocations) || input.allocations.length === 0 || input.allocations.length > MAX_ALLOCATIONS) throw new BudgetRecommendationValidationError("allocations must contain between 1 and 100 targets");
  const allocations = input.allocations.map(parseTarget);
  const targetKeys = new Set<string>();
  for (const allocation of allocations) {
    const key = allocation.categoryId ? `category:${allocation.categoryId}` : `subcategory:${allocation.subcategoryId}`;
    if (targetKeys.has(key)) throw new BudgetRecommendationValidationError("allocation targets must be unique");
    targetKeys.add(key);
  }
  return {
    periodKind: input.periodKind as BudgetRecommendationRequest["periodKind"], periodStart, periodEnd, totalAmountMinor, debtBudgetAmountMinor, savingsBudgetAmountMinor, allocations,
    ...(input.historicalTransactions === undefined ? {} : { historicalTransactions: parseTransactions(input.historicalTransactions) }),
    ...(input.forecast === undefined ? {} : { forecast: parseForecast(input.forecast) }),
  };
}

function parseDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new BudgetRecommendationValidationError(`${field} is invalid`);
  return value;
}

function parsePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new BudgetRecommendationValidationError(`${field} must be a positive integer`);
  return value;
}

function parseNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new BudgetRecommendationValidationError(`${field} must be a non-negative integer`);
  return value;
}

function parseTarget(value: unknown): BudgetRecommendationTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BudgetRecommendationValidationError("allocation is invalid");
  const input = value as Record<string, unknown>;
  const categoryId = typeof input.categoryId === "string" && input.categoryId.trim() ? input.categoryId : null;
  const subcategoryId = typeof input.subcategoryId === "string" && input.subcategoryId.trim() ? input.subcategoryId : null;
  if ((categoryId === null) === (subcategoryId === null)) throw new BudgetRecommendationValidationError("each allocation must reference one category or subcategory");
  return { categoryId, subcategoryId, preferredAmountMinor: parseNonNegativeInteger(input.preferredAmountMinor, "preferredAmountMinor") };
}

function parseTransactions(value: unknown): BudgetRecommendationTransaction[] {
  if (!Array.isArray(value) || value.length > MAX_TRANSACTIONS) throw new BudgetRecommendationValidationError("historicalTransactions must contain at most 500 transactions");
  return value.map((transaction) => {
    if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) throw new BudgetRecommendationValidationError("historical transaction is invalid");
    const input = transaction as Record<string, unknown>;
    if (typeof input.transactionId !== "string" || !UUID.test(input.transactionId)) throw new BudgetRecommendationValidationError("transactionId is invalid");
    const date = parseDate(input.date, "transaction date");
    const amountMinor = typeof input.amount === "number" && Number.isFinite(input.amount) ? Math.round(input.amount * 100) : 0;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new BudgetRecommendationValidationError("transaction amount is invalid");
    if (typeof input.category !== "string" || !input.category.trim() || input.category.length > MAX_TEXT_LENGTH) throw new BudgetRecommendationValidationError("transaction category is invalid");
    if (input.transactionType !== "income" && input.transactionType !== "expense") throw new BudgetRecommendationValidationError("transactionType is invalid");
    return { transactionId: input.transactionId, date, amount: amountMinor / 100, category: input.category.trim(), transactionType: input.transactionType };
  });
}

function parseForecast(value: unknown): BudgetRecommendationForecast {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BudgetRecommendationValidationError("forecast is invalid");
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || input.forecastHorizon !== "MONTHLY" || input.forecastLevel !== "CATEGORY_GROUP" || (input.status !== "SUCCESS" && input.status !== "FALLBACK") || !Array.isArray(input.forecasts) || input.forecasts.length > MAX_FORECAST_POINTS) throw new BudgetRecommendationValidationError("forecast is invalid");
  const forecasts = input.forecasts.map((point) => {
    if (!point || typeof point !== "object" || Array.isArray(point)) throw new BudgetRecommendationValidationError("forecast point is invalid");
    const item = point as Record<string, unknown>;
    const date = parseDate(item.date, "forecast date");
    if (typeof item.amountMinor !== "number" || !Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0) throw new BudgetRecommendationValidationError("forecast amount is invalid");
    if (item.category !== null && (typeof item.category !== "string" || !item.category.trim() || item.category.length > MAX_TEXT_LENGTH)) throw new BudgetRecommendationValidationError("forecast category is invalid");
    return { date, amountMinor: item.amountMinor, category: typeof item.category === "string" ? item.category.trim() : null };
  });
  const interval = input.confidenceInterval;
  if (!interval || typeof interval !== "object" || Array.isArray(interval)) throw new BudgetRecommendationValidationError("forecast confidence interval is invalid");
  const confidenceInterval = interval as Record<string, unknown>;
  const parseMinor = (field: string) => {
    const amount = confidenceInterval[field];
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0) throw new BudgetRecommendationValidationError("forecast confidence interval is invalid");
    return amount;
  };
  return { version: 1, forecasts, forecastHorizon: "MONTHLY", forecastLevel: "CATEGORY_GROUP", confidenceInterval: { lower80Minor: parseMinor("lower80Minor"), upper80Minor: parseMinor("upper80Minor"), lower95Minor: parseMinor("lower95Minor"), upper95Minor: parseMinor("upper95Minor") }, status: input.status };
}

async function verifyTargets(supabase: SupabaseClient, userId: string, targets: BudgetRecommendationTarget[]): Promise<void> {
  const categoryIds = targets.flatMap((target) => target.categoryId ? [target.categoryId] : []);
  const subcategoryIds = targets.flatMap((target) => target.subcategoryId ? [target.subcategoryId] : []);
  const [categories, subcategories] = await Promise.all([
    categoryIds.length ? supabase.from("categories").select("id").in("id", categoryIds).eq("deleted", false).eq("is_active", true).or(`user_id.is.null,user_id.eq.${userId}`) : Promise.resolve({ data: [], error: null }),
    subcategoryIds.length ? supabase.from("subcategories").select("id").in("id", subcategoryIds).eq("deleted", false).eq("is_active", true).eq("kind", "expense").or(`user_id.is.null,user_id.eq.${userId}`) : Promise.resolve({ data: [], error: null }),
  ]);
  if (categories.error || subcategories.error) throw new BudgetRecommendationUpstreamError(503, "taxonomy validation unavailable");
  if ((categories.data?.length ?? 0) !== categoryIds.length || (subcategories.data?.length ?? 0) !== subcategoryIds.length) throw new BudgetRecommendationValidationError("allocation target is not accessible");
}

export async function getBudgetRecommendation(userId: string, request: BudgetRecommendationRequest, supabase: SupabaseClient, fetcher: typeof fetch = fetch): Promise<BudgetRecommendationPayload> {
  await verifyTargets(supabase, userId, request.allocations);
  const baseUrl = process.env.BUDGET_ML_BASE_URL;
  if (!baseUrl) throw new BudgetRecommendationUpstreamError(503, "budget optimizer unavailable");
  const availableFundsMinor = request.totalAmountMinor - request.debtBudgetAmountMinor - request.savingsBudgetAmountMinor;
  const preferredTotal = request.allocations.reduce((total, allocation) => total + allocation.preferredAmountMinor, 0);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/v1/budget/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        request_id: randomUUID(), user_id: userId, available_funds: availableFundsMinor / 100,
        period: { start: request.periodStart, end: request.periodEnd }, include_reasoning: false,
        categories: request.allocations.map((target) => ({ category_id: target.categoryId ?? target.subcategoryId, restriction_level: "FREE", floor: 0, ceiling: availableFundsMinor / 100, priority_weight: 1 })),
        target_ratios: Object.fromEntries(request.allocations.map((target) => [target.categoryId ?? target.subcategoryId!, preferredTotal ? target.preferredAmountMinor / preferredTotal : 1 / request.allocations.length])),
        ...(request.historicalTransactions === undefined ? {} : { transaction_history: request.historicalTransactions.map((transaction) => ({ transaction_id: transaction.transactionId, date: transaction.date, amount: transaction.amount, category: transaction.category, transaction_type: transaction.transactionType })) }),
        ...(request.forecast === undefined ? {} : { forecast: {
          version: request.forecast.version,
          forecasts: request.forecast.forecasts.map((point) => ({ date: point.date, amount: point.amountMinor / 100, category: point.category })),
          forecast_horizon: request.forecast.forecastHorizon,
          forecast_level: request.forecast.forecastLevel,
          confidence_interval: {
            lower_80: request.forecast.confidenceInterval.lower80Minor / 100,
            upper_80: request.forecast.confidenceInterval.upper80Minor / 100,
            lower_95: request.forecast.confidenceInterval.lower95Minor / 100,
            upper_95: request.forecast.confidenceInterval.upper95Minor / 100,
          },
          status: request.forecast.status,
        } }),
      }),
    });
    if (!response.ok) throw new BudgetRecommendationUpstreamError(response.status, "budget optimizer rejected request");
    return mapMlBudgetResponse(await response.json(), request, availableFundsMinor);
  } catch (error) {
    if (error instanceof BudgetRecommendationUpstreamError) throw error;
    throw new BudgetRecommendationUpstreamError(503, error instanceof Error && error.name === "AbortError" ? "budget optimizer timed out" : "budget optimizer unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export function mapMlBudgetResponse(value: unknown, request: BudgetRecommendationRequest, availableFundsMinor: number): BudgetRecommendationPayload {
  const response = value as MlBudgetResponse;
  const allocations = response?.recommendation?.allocations;
  if (!Array.isArray(allocations) || allocations.length !== request.allocations.length) throw new BudgetRecommendationUpstreamError(502, "budget optimizer returned an invalid response");
  const requestedById = new Map(request.allocations.map((target) => [target.categoryId ?? target.subcategoryId!, target]));
  const amounts = new Map<string, number>();
  for (const allocation of allocations) {
    if (!allocation || typeof allocation.category_id !== "string" || !requestedById.has(allocation.category_id) || amounts.has(allocation.category_id) || typeof allocation.amount !== "number" || !Number.isFinite(allocation.amount) || allocation.amount < 0) throw new BudgetRecommendationUpstreamError(502, "budget optimizer returned an invalid response");
    amounts.set(allocation.category_id, Math.round(allocation.amount * 100));
  }
  const mapped = request.allocations.map((target) => ({ ...target, amountMinor: amounts.get(target.categoryId ?? target.subcategoryId!)! }));
  const reconciliation = availableFundsMinor - mapped.reduce((total, target) => total + target.amountMinor, 0);
  const final = mapped[mapped.length - 1]!;
  if (final.amountMinor + reconciliation < 0) throw new BudgetRecommendationUpstreamError(502, "budget optimizer returned an invalid response");
  final.amountMinor += reconciliation;
  return { availableFundsMinor, debtBudgetAmountMinor: request.debtBudgetAmountMinor, savingsBudgetAmountMinor: request.savingsBudgetAmountMinor, allocations: mapped };
}

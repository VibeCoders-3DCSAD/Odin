const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_FINANCIAL_PLAN_MODEL = "qwen/qwen3.8-27b";
const MAX_INSIGHTS = 3;
const MAX_TEXT_LENGTH = 360;

export type FinancialPlanEvidence = {
  planPeriodLabel: string;
  surplusCentavos: number;
  debtSurplusCentavos: number;
  savingsSurplusCentavos: number;
  shortfall?: { plannedAmountCentavos: number; requiredFundsCentavos: number; shortfallCentavos: number };
  seasonalPreferences: Array<{ evidenceId: string; season: string; seasonWindow: string; preference: "saving" | "higher_expense" }>;
  forecastChanges: Array<{ evidenceId: string; categoryName: string; baselineCentavos: number; forecastCentavos: number; allocationCentavos: number; allocationForecastDifferenceCentavos: number; differenceCentavos: number; percentageChange: number | null; forecastRationale: string; possibleSeasonalContext: string | null }>;
};

export type ZeroAllocationEvidence = {
  categoryName: string;
  allocationCentavos: number;
  requiredFloorCentavos: number;
  forecastCentavos: number;
};

type Insight = { type: "surplus" | "shortfall" | "forecast_change" | "seasonal_preference"; title: string; message: string; evidence_ids: string[] };

const systemPrompt = `You write concise, supportive explanations for Odin's Financial Plan.

You are an interpretation layer only. Plan allocations, forecasts, reserves, and surplus amounts are final. Use only PLAN_EVIDENCE. Never invent facts, prices, inflation, historical behavior, financial advice, categories, goals, dates, amounts, or causes. A stated preference is not history: say "You selected...", never "You usually...". Do not use should, must, guaranteed, or will. Do not recommend actions, transfers, contributions, or changes to the plan.

Never mention HFCE, its expanded name, economic indicators, model names, model versions, or underlying forecast methodology.

Write up to three distinct, concise interpretations. The plan period is supplied, but do not mention a quarter label. A forecast is only for the exact category name supplied in forecastChanges; never rename it as a subcategory. When forecastRationale is non-empty, include a brief paraphrase of it in that category's forecast insight. If possibleSeasonalContext is non-empty, it may be mentioned as possible context for a higher forecast, never as its cause. Keep each selected season separate. If a season is selected for both saving and higher expenses, describe only that season's trade-off. Do not combine Christmas and Ber Months with Summer or any other distinct season.

Good examples:
- "Education is forecast at PHP 4,000.00, 12% above its PHP 3,571.43 baseline. The plan allocates PHP 3,800.00, PHP 200.00 below that forecast."
- "You selected Christmas and Ber Months as a season for saving. This preference is shown alongside the plan's calculated amounts."
- "You selected Summer for higher expenses. This is a separate preference from your Christmas and Ber Months selections."
- "Required commitments total PHP 6,500.00 against PHP 5,000.00 planned, leaving a PHP 1,500.00 shortfall."

Return valid JSON only in this exact shape:
{"insights":[{"type":"surplus|shortfall|forecast_change|seasonal_preference","title":"max 60 chars","message":"max 360 chars","evidence_ids":["evidence id"]}]}

Return zero to three insights. Every insight must cite one or more supplied evidence IDs. Mention money as PHP 1,234.00. A forecast change may only state the supplied baseline, forecast, allocation, forecast difference, allocation-forecast difference, percentage change, forecast rationale, and possible seasonal context. A surplus insight may only state the supplied surplus amounts. A shortfall insight may only state the supplied planned amount, required funds, and shortfall.`;

function isInsight(value: unknown, validEvidenceIds: Set<string>): value is Insight {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const insight = value as Record<string, unknown>;
  return ["surplus", "shortfall", "forecast_change", "seasonal_preference"].includes(insight.type as string)
    && typeof insight.title === "string" && insight.title.trim().length > 0 && insight.title.length <= 60
    && typeof insight.message === "string" && insight.message.trim().length > 0 && insight.message.length <= MAX_TEXT_LENGTH
    && Array.isArray(insight.evidence_ids) && insight.evidence_ids.length > 0
    && insight.evidence_ids.every((id) => typeof id === "string" && validEvidenceIds.has(id));
}

function parseInsights(value: unknown, validEvidenceIds: Set<string>): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const insights = (value as { insights?: unknown }).insights;
  if (!Array.isArray(insights)) return [];
  const accepted: Insight[] = [];
  const messages = new Set<string>();
  for (const insight of insights) {
    if (!isInsight(insight, validEvidenceIds)) continue;
    const normalizedMessage = insight.message.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    if (messages.has(normalizedMessage)) continue;
    messages.add(normalizedMessage);
    accepted.push(insight);
    if (accepted.length === MAX_INSIGHTS) break;
  }
  return accepted.sort((left, right) => Number(right.type === "shortfall") - Number(left.type === "shortfall")).map((insight) => insight.message.trim());
}

export async function explainFinancialPlan(evidence: FinancialPlanEvidence, fetcher: typeof fetch = fetch, userId?: string): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.info("financial plan Groq explanation skipped", { user_id: userId ?? null, reason: "api_key_unconfigured" });
    return [];
  }
  const validEvidenceIds = new Set([...evidence.seasonalPreferences, ...evidence.forecastChanges].map((item) => item.evidenceId));
  if (evidence.surplusCentavos > 0) validEvidenceIds.add("plan-surplus");
  if (evidence.shortfall && evidence.shortfall.shortfallCentavos > 0) validEvidenceIds.add("plan-shortfall");
  if (validEvidenceIds.size === 0) {
    console.info("financial plan Groq explanation skipped", { user_id: userId ?? null, reason: "no_eligible_evidence" });
    return [];
  }

  const body = JSON.stringify({
    model: process.env.GROQ_FINANCIAL_PLAN_MODEL ?? DEFAULT_GROQ_FINANCIAL_PLAN_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `PLAN_EVIDENCE:\n${JSON.stringify(evidence)}` }],
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  const startedAt = Date.now();
  console.info("financial plan Groq explanation requested", { user_id: userId ?? null, evidence_count: validEvidenceIds.size, model: process.env.GROQ_FINANCIAL_PLAN_MODEL ?? DEFAULT_GROQ_FINANCIAL_PLAN_MODEL });
  try {
    const response = await fetcher(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("financial plan Groq explanation failed", { user_id: userId ?? null, status: response.status, duration_ms: Date.now() - startedAt });
      return [];
    }
    const payload: unknown = await response.json();
    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length > 10_000) {
      console.warn("financial plan Groq explanation failed", { user_id: userId ?? null, reason: "invalid_response", duration_ms: Date.now() - startedAt });
      return [];
    }
    try {
      const insights = parseInsights(JSON.parse(content), validEvidenceIds);
      console.info("financial plan Groq explanation completed", { user_id: userId ?? null, insight_count: insights.length, duration_ms: Date.now() - startedAt });
      return insights;
    } catch {
      console.warn("financial plan Groq explanation failed", { user_id: userId ?? null, reason: "invalid_json", duration_ms: Date.now() - startedAt });
      return [];
    }
  } catch (error) {
    console.warn("financial plan Groq explanation failed", { user_id: userId ?? null, reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "request_error", duration_ms: Date.now() - startedAt });
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export function fallbackFinancialPlanExplanations(evidence: FinancialPlanEvidence): string[] {
  const explanations: string[] = [];
  const peso = (amountCentavos: number) => `PHP ${(amountCentavos / 100).toFixed(2)}`;
  if (evidence.shortfall && evidence.shortfall.shortfallCentavos > 0) explanations.push(`Required commitments total ${peso(evidence.shortfall.requiredFundsCentavos)} against ${peso(evidence.shortfall.plannedAmountCentavos)} planned, leaving a ${peso(evidence.shortfall.shortfallCentavos)} shortfall.`);
  if (evidence.surplusCentavos > 0) explanations.push(`After planned requirements, ${peso(evidence.surplusCentavos)} remains available for your review. It is not automatically assigned to debt or savings.`);
  const preferencesBySeason = new Map<string, Set<FinancialPlanEvidence["seasonalPreferences"][number]["preference"]>>();
  for (const preference of evidence.seasonalPreferences) preferencesBySeason.set(preference.season, new Set([...(preferencesBySeason.get(preference.season) ?? []), preference.preference]));
  const firstSeason = preferencesBySeason.entries().next().value as [string, Set<FinancialPlanEvidence["seasonalPreferences"][number]["preference"]>] | undefined;
  if (firstSeason) {
    const [season, preferences] = firstSeason;
    explanations.push(preferences.has("saving") && preferences.has("higher_expense")
      ? `For ${season}, you selected both saving and higher expenses. That trade-off is kept visible while you review this plan.`
      : preferences.has("saving")
        ? `You selected ${season} as a time to prioritize saving, alongside this plan's calculated allocations.`
        : `You selected ${season} as a period of higher expenses, which provides context for reviewing this plan.`);
  }
  const [change] = [...evidence.forecastChanges].sort((left, right) => Math.abs(right.differenceCentavos) - Math.abs(left.differenceCentavos));
  if (change && change.differenceCentavos !== 0) {
    const direction = change.differenceCentavos > 0 ? "above" : "below";
    const allocationDifference = change.allocationForecastDifferenceCentavos;
    const allocationContext = allocationDifference === 0
      ? `The plan allocates the same ${peso(change.allocationCentavos)}.`
      : `The plan allocates ${peso(change.allocationCentavos)}, ${peso(Math.abs(allocationDifference))} ${allocationDifference > 0 ? "above" : "below"} the forecast.`;
    const percentage = change.percentageChange === null ? "" : ` (${change.percentageChange > 0 ? "+" : ""}${change.percentageChange.toFixed(1)}%)`;
    const rationale = change.forecastRationale ? ` Forecast context: ${change.forecastRationale}` : "";
    const seasonalContext = change.possibleSeasonalContext && change.differenceCentavos > 0 ? ` ${change.possibleSeasonalContext} is also selected as a higher-expense season and may be relevant context.` : "";
    explanations.push(`${change.categoryName} is forecast at ${peso(change.forecastCentavos)} versus ${peso(change.baselineCentavos)}, ${peso(Math.abs(change.differenceCentavos))} ${direction} baseline${percentage}. ${allocationContext}${rationale}${seasonalContext}`);
  }
  return explanations.map((message) => message.slice(0, MAX_TEXT_LENGTH));
}

export function zeroAllocationExplanations(allocations: ZeroAllocationEvidence[]): string[] {
  return allocations
    .filter((allocation) => allocation.allocationCentavos === 0)
    .slice(0, 1)
    .map((allocation) => {
      const peso = (amountCentavos: number) => `PHP ${(amountCentavos / 100).toFixed(2)}`;
      if (allocation.requiredFloorCentavos > 0) return `${allocation.categoryName} received ${peso(0)} despite a required floor of ${peso(allocation.requiredFloorCentavos)}.`;
      if (allocation.forecastCentavos === 0) return `${allocation.categoryName} received ${peso(0)} because it has no required peso allocation or forecasted spending.`;
      return `${allocation.categoryName} received ${peso(0)}. It has no required peso allocation; its available forecast is ${peso(allocation.forecastCentavos)}.`;
    });
}

export function isUserFacingFinancialPlanExplanation(value: string): boolean {
  return !/\bhfce\b|household final consumption expenditure/i.test(value);
}

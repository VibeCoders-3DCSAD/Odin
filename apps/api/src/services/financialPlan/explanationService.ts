const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_INSIGHTS = 3;
const MAX_TEXT_LENGTH = 240;

export type FinancialPlanEvidence = {
  planPeriodLabel: string;
  surplusCentavos: number;
  debtSurplusCentavos: number;
  savingsSurplusCentavos: number;
  seasonalPreferences: Array<{ evidenceId: string; season: string; preference: "saving" | "higher_expense" }>;
  forecastChanges: Array<{ evidenceId: string; categoryName: string; baselineCentavos: number; forecastCentavos: number; differenceCentavos: number }>;
};

type Insight = { type: "surplus" | "forecast_change" | "seasonal_preference"; title: string; message: string; evidence_ids: string[] };

const systemPrompt = `You write concise, supportive explanations for Odin's Financial Plan.

You are an explanation layer only. Plan allocations, forecasts, reserves, and surplus amounts are final. Use only PLAN_EVIDENCE. Never invent facts, prices, inflation, historical behavior, financial advice, categories, goals, dates, or amounts. A stated preference is not history: say "You selected...", never "You usually...". Do not use should, must, guaranteed, or will.

Return valid JSON only in this exact shape:
{"insights":[{"type":"surplus|forecast_change|seasonal_preference","title":"max 60 chars","message":"max 220 chars","evidence_ids":["evidence id"]}]}

Return zero to three insights. Every insight must cite one or more supplied evidence IDs. Mention money as PHP 1,234.00. A forecast change may only state the supplied baseline, forecast, and difference. A surplus insight may only state the supplied surplus amounts.`;

function isInsight(value: unknown, validEvidenceIds: Set<string>): value is Insight {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const insight = value as Record<string, unknown>;
  return ["surplus", "forecast_change", "seasonal_preference"].includes(insight.type as string)
    && typeof insight.title === "string" && insight.title.trim().length > 0 && insight.title.length <= 60
    && typeof insight.message === "string" && insight.message.trim().length > 0 && insight.message.length <= 220
    && Array.isArray(insight.evidence_ids) && insight.evidence_ids.length > 0
    && insight.evidence_ids.every((id) => typeof id === "string" && validEvidenceIds.has(id));
}

function parseInsights(value: unknown, validEvidenceIds: Set<string>): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const insights = (value as { insights?: unknown }).insights;
  if (!Array.isArray(insights)) return [];
  return insights.filter((insight): insight is Insight => isInsight(insight, validEvidenceIds)).slice(0, MAX_INSIGHTS).map((insight) => insight.message.trim());
}

export async function explainFinancialPlan(evidence: FinancialPlanEvidence, fetcher: typeof fetch = fetch): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];
  const validEvidenceIds = new Set([...evidence.seasonalPreferences, ...evidence.forecastChanges].map((item) => item.evidenceId));
  if (evidence.surplusCentavos > 0) validEvidenceIds.add("plan-surplus");
  if (validEvidenceIds.size === 0) return [];

  const body = JSON.stringify({
    model: process.env.GROQ_FINANCIAL_PLAN_MODEL ?? "moonshotai/kimi-k2-instruct",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `PLAN_EVIDENCE:\n${JSON.stringify(evidence)}` }],
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetcher(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length > 10_000) return [];
    try { return parseInsights(JSON.parse(content), validEvidenceIds); } catch { return []; }
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export function fallbackFinancialPlanExplanations(evidence: FinancialPlanEvidence): string[] {
  const explanations: string[] = [];
  if (evidence.surplusCentavos > 0) explanations.push(`Forecast surplus: ${(evidence.debtSurplusCentavos / 100).toFixed(2)} reserved for debt and ${(evidence.savingsSurplusCentavos / 100).toFixed(2)} reserved for savings.`);
  for (const preference of evidence.seasonalPreferences.filter((item) => item.preference === "saving").slice(0, 1)) {
    explanations.push(`You selected ${preference.season} as a season when you are more likely to save.`);
  }
  for (const change of evidence.forecastChanges.filter((item) => item.differenceCentavos > 0).slice(0, 1)) {
    explanations.push(`${change.categoryName} is forecast at PHP ${(change.differenceCentavos / 100).toFixed(2)} above its supplied baseline for ${evidence.planPeriodLabel}.`);
  }
  return explanations.map((message) => message.slice(0, MAX_TEXT_LENGTH));
}

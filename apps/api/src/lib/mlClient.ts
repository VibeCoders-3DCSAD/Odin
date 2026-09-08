import {
  EMERGENCY_RUNWAYS,
  FINANCIAL_PROFILE_LABELS,
  INCOME_PATTERNS,
  OBLIGATION_LOADS,
} from "./constants.js";

export type PfpQuestionnaireFailureReason = "not_configured" | "timeout" | "network_error" | "http_error" | "invalid_response";

export type PfpQuestionnaireResult =
  | { ok: true; classification: { prediction: typeof FINANCIAL_PROFILE_LABELS[number]; confidence: number; modelName: string; modelVersion: string } }
  | { ok: false; reason: PfpQuestionnaireFailureReason };

function questionnairePayload(answers: Record<string, unknown>) {
  const incomePattern = answers.income_pattern;
  const obligationLoad = answers.obligation_load;
  const emergencyRunway = answers.emergency_runway;
  if (!INCOME_PATTERNS.includes(incomePattern as typeof INCOME_PATTERNS[number])
    || !OBLIGATION_LOADS.includes(obligationLoad as typeof OBLIGATION_LOADS[number])
    || !EMERGENCY_RUNWAYS.includes(emergencyRunway as typeof EMERGENCY_RUNWAYS[number])) return null;

  return {
    income_variability: incomePattern === "predictable_income" ? "stable" : "variable",
    obligation_level: obligationLoad === "no_income_with_obligations" || obligationLoad === "high"
      ? "high"
      : obligationLoad === "medium" ? "medium" : "low",
    emergency_runway: emergencyRunway === "less_than_1_month" ? "low"
      : emergencyRunway === "1_to_3_months" ? "medium"
      : emergencyRunway === "3_to_6_months" ? "3" : "high",
  };
}

export async function classifyPfpQuestionnaire(userId: string, answers: Record<string, unknown>): Promise<PfpQuestionnaireResult> {
  const baseUrl = process.env.ML_SERVICE_URL?.replace(/\/$/, "");
  const questionnaireAnswers = questionnairePayload(answers);
  if (!baseUrl || !questionnaireAnswers) return { ok: false, reason: "not_configured" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${baseUrl}/api/v1/pfp/classify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ user_id: userId, classification_mode: "QUESTIONNAIRE", payload: { questionnaire_answers: questionnaireAnswers } }),
    });
    if (!response.ok) return { ok: false, reason: "http_error" };
    const body: unknown = await response.json();
    const value = body as { classification?: { prediction?: unknown; confidence?: unknown; model_name?: unknown }; metadata?: { model_version?: unknown; strategy_used?: unknown } };
    const prediction = value.classification?.prediction;
    const confidence = value.classification?.confidence;
    const modelName = value.classification?.model_name;
    const modelVersion = value.metadata?.model_version;
    if (!FINANCIAL_PROFILE_LABELS.includes(prediction as typeof FINANCIAL_PROFILE_LABELS[number])
      || typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1
      || modelName !== "questionnaire_rule"
      || typeof modelVersion !== "string" || !modelVersion.trim()
      || value.metadata?.strategy_used !== "QUESTIONNAIRE") return { ok: false, reason: "invalid_response" };
    return { ok: true, classification: { prediction: prediction as typeof FINANCIAL_PROFILE_LABELS[number], confidence, modelName, modelVersion } };
  } catch (error) {
    return { ok: false, reason: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}

import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { ONBOARDING_ERRORS, VALID_EMPLOYMENT_CLASSIFICATIONS, VALID_METRO_MANILA_PRESENCE } from "../lib/constants.js";
import { getServiceRoleClient } from "../lib/supabase.js";

const router = Router();

const ONBOARDING_ANSWER_KEYS = new Set([
  "display_name", "date_of_birth", "is_filipino", "metro_manila_presence", "metro_manila_locality_code",
  "primary_employment_classification", "employment_status", "income_stability",
  "income_type", "pay_frequency", "monthly_income", "fixed_obligation_types",
  "monthly_obligations", "protected_categories", "has_dependents",
]);

const ARRAY_ANSWER_KEYS = new Set(["fixed_obligation_types", "protected_categories"]);
const STRING_ANSWER_KEYS = new Set([...ONBOARDING_ANSWER_KEYS].filter((key) => !ARRAY_ANSWER_KEYS.has(key) && key !== "has_dependents"));
const ANSWER_OPTIONS: Record<string, readonly string[]> = {
  is_filipino: ["true", "false"],
  metro_manila_presence: VALID_METRO_MANILA_PRESENCE,
  primary_employment_classification: VALID_EMPLOYMENT_CLASSIFICATIONS,
  employment_status: ["employed_full_time", "employed_part_time", "self_employed", "unemployed", "retired", "student"],
  income_stability: ["very_stable", "stable", "somewhat_unstable", "very_unstable"],
  income_type: ["stable", "variable"],
  pay_frequency: ["weekly", "bi_weekly", "semi_monthly", "monthly", "irregular", "annual"],
  fixed_obligation_types: ["rent_mortgage", "loan_payments", "insurance", "utilities", "tuition", "support_payments", "none"],
  protected_categories: ["dependents_children", "dependents_elderly", "pwd", "solo_parent", "indigenous", "none"],
};

function validateOnboardingPayload(
  raw_answers: unknown,
  current_step_key: unknown,
): string | null {
  if (raw_answers !== undefined && (typeof raw_answers !== "object" || raw_answers === null || Array.isArray(raw_answers))) {
    return "raw_answers must be a plain object when provided.";
  }
  if (raw_answers && typeof raw_answers === "object" && !Array.isArray(raw_answers)) {
    for (const [key, value] of Object.entries(raw_answers)) {
      if (!ONBOARDING_ANSWER_KEYS.has(key)) return `Unsupported onboarding answer: ${key}.`;
      if (ARRAY_ANSWER_KEYS.has(key) && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) {
        return `${key} must be an array of strings.`;
      }
      if (STRING_ANSWER_KEYS.has(key) && typeof value !== "string") return `${key} must be a string.`;
      if (key === "has_dependents" && typeof value !== "boolean") return "has_dependents must be a boolean.";
      const options = ANSWER_OPTIONS[key];
      if (options && typeof value === "string" && value !== "" && !options.includes(value)) return `Invalid ${key}.`;
      if (options && Array.isArray(value) && value.some((item) => !options.includes(item))) return `Invalid ${key}.`;
      if ((key === "monthly_income" || key === "monthly_obligations") && typeof value === "string" && value !== "" && !/^\d+$/.test(value)) {
        return `${key} must be a non-negative whole number.`;
      }
    }
  }
  if (current_step_key !== undefined && current_step_key !== null && typeof current_step_key !== "string") {
    return "current_step_key must be a string when provided.";
  }
  return null;
}

router.post("/onboarding/sessions", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;
  const { raw_answers, current_step_key } = request.body?.payload ?? {};

  const validationError = validateOnboardingPayload(raw_answers, current_step_key);
  if (validationError) {
    response.status(400).json({
      error: "Bad Request",
      message: validationError,
    });
    return;
  }

  const { data: session, error: rpcError } = await authenticatedSupabase
    .rpc("create_onboarding_session", {
      p_raw_answers: raw_answers ?? {},
      p_current_step_key: current_step_key ?? null,
    })
    .single();

  if (rpcError || !session) {
    response.status(500).json({
      error: "Internal Server Error",
      message: ONBOARDING_ERRORS.session_create_failed,
    });
    return;
  }

  response.status(201).json({ payload: { session } });
});

router.patch("/onboarding/sessions/:id", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;
  const sessionId = request.params.id;
  const { raw_answers, current_step_key } = request.body?.payload ?? {};

  const validationError = validateOnboardingPayload(raw_answers, current_step_key);
  if (validationError) {
    response.status(400).json({
      error: "Bad Request",
      message: validationError,
    });
    return;
  }

  const { data: existing, error: fetchError } = await authenticatedSupabase
    .from("onboarding_sessions")
    .select("id, status, raw_answers")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: ONBOARDING_ERRORS.session_fetch_failed,
    });
    return;
  }

  if (!existing) {
    response.status(404).json({
      error: "Not Found",
      message: ONBOARDING_ERRORS.session_not_found,
    });
    return;
  }

  if (existing.status !== "in_progress") {
    response.status(409).json({
      error: "Conflict",
      message: ONBOARDING_ERRORS.session_not_in_progress,
    });
    return;
  }

  const updateData: Record<string, unknown> = {};

  if (raw_answers !== undefined) {
    const mergedAnswers = { ...(existing.raw_answers as Record<string, unknown> | undefined), ...raw_answers };
    updateData.raw_answers = mergedAnswers;
  }

  if (current_step_key !== undefined) {
    updateData.current_step_key = current_step_key;
  }

  if (Object.keys(updateData).length === 0) {
    response.status(400).json({
      error: "Bad Request",
      message: "No fields to update.",
    });
    return;
  }

  const { data: updated, error: updateError } = await authenticatedSupabase
    .from("onboarding_sessions")
    .update(updateData)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("id, user_id, status, started_at, submitted_at, current_step_key, raw_answers, metadata")
    .single();

  if (updateError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: ONBOARDING_ERRORS.session_update_failed,
    });
    return;
  }

  response.status(200).json({ payload: { session: updated } });
});

router.post("/onboarding/sessions/:id/responses", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;
  const sessionId = request.params.id;
  const { question_key, answer } = request.body?.payload ?? {};

  if (typeof question_key !== "string" || question_key.trim() === "") {
    response.status(400).json({
      error: "Bad Request",
      message: "question_key is required.",
    });
    return;
  }

  if (answer === undefined) {
    response.status(400).json({
      error: "Bad Request",
      message: "answer is required.",
    });
    return;
  }

  const { data: session, error: sessionError } = await authenticatedSupabase
    .from("onboarding_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: ONBOARDING_ERRORS.session_fetch_failed,
    });
    return;
  }

  if (!session) {
    response.status(404).json({
      error: "Not Found",
      message: ONBOARDING_ERRORS.session_not_found,
    });
    return;
  }

  if (session.status !== "in_progress") {
    response.status(409).json({
      error: "Conflict",
      message: ONBOARDING_ERRORS.session_not_in_progress,
    });
    return;
  }

  const { data: upserted, error: upsertError } = await authenticatedSupabase
    .from("onboarding_responses")
    .upsert(
      {
        onboarding_session_id: sessionId,
        question_key: question_key.trim(),
        answer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "onboarding_session_id, question_key" },
    )
    .select("onboarding_session_id, question_key, answer, updated_at")
    .single();

  if (upsertError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: ONBOARDING_ERRORS.response_create_failed,
    });
    return;
  }

  response.status(200).json({ payload: { response: upserted } });
});

router.post("/onboarding/sessions/:id/submit", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;
  const sessionId = request.params.id;
  const { confirm_data_use } = request.body?.payload ?? {};

  if (confirm_data_use !== true) {
    response.status(400).json({
      error: "Bad Request",
      message: ONBOARDING_ERRORS.submit_not_confirmed,
    });
    return;
  }

  const { data: session, error: sessionError } = await authenticatedSupabase
    .from("onboarding_sessions")
    .select("id, status, raw_answers")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: ONBOARDING_ERRORS.session_fetch_failed,
    });
    return;
  }

  if (!session) {
    response.status(404).json({
      error: "Not Found",
      message: ONBOARDING_ERRORS.session_not_found,
    });
    return;
  }

  if (session.status !== "in_progress") {
    response.status(409).json({
      error: "Conflict",
      message: ONBOARDING_ERRORS.session_not_in_progress,
    });
    return;
  }

  const rawAnswers = (session.raw_answers ?? {}) as Record<string, unknown>;
  const rawAnswersValidationError = validateOnboardingPayload(rawAnswers, undefined);
  if (rawAnswersValidationError) {
    response.status(400).json({ error: "Bad Request", message: rawAnswersValidationError });
    return;
  }
  const requiredFields = [
    "display_name",
    "date_of_birth",
    "is_filipino",
    "metro_manila_presence",
    "metro_manila_locality_code",
    "primary_employment_classification",
    "employment_status",
    "income_stability",
    "income_type",
    "pay_frequency",
    "monthly_income",
    "fixed_obligation_types",
    "monthly_obligations",
    "protected_categories",
  ];
  const missing = requiredFields.filter((f) => {
    const v = rawAnswers[f];
    if (f === "monthly_income" || f === "monthly_obligations")
      return typeof v !== "string" || v === "";
    if (f === "fixed_obligation_types" || f === "protected_categories")
      return !Array.isArray(v) || v.length === 0;
    return typeof v !== "string" || v === "";
  });
  if (missing.length > 0) {
    response.status(400).json({
      error: "Bad Request",
      message: "Onboarding questionnaire is incomplete. Please complete all required steps before submitting.",
      fields: missing,
    });
    return;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof rawAnswers.date_of_birth === "string") {
    if (!dateRegex.test(rawAnswers.date_of_birth)) {
      response.status(400).json({ error: "Bad Request", message: "date_of_birth must be in YYYY-MM-DD format." });
      return;
    }
    const [y, m, d] = rawAnswers.date_of_birth.split("-").map(Number) as [number, number, number];
    const parsed = new Date(Date.UTC(y!, m! - 1, d!));
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() + 1 !== m || parsed.getUTCDate() !== d) {
      response.status(400).json({ error: "Bad Request", message: "date_of_birth must be a valid calendar date in YYYY-MM-DD format." });
      return;
    }
  }
  if (typeof rawAnswers.is_filipino === "string" && !["true", "false"].includes(rawAnswers.is_filipino)) {
    response.status(400).json({ error: "Bad Request", message: "is_filipino must be 'true' or 'false'." });
    return;
  }
  if (typeof rawAnswers.metro_manila_presence === "string" && !VALID_METRO_MANILA_PRESENCE.includes(rawAnswers.metro_manila_presence)) {
    response.status(400).json({ error: "Bad Request", message: `Invalid metro_manila_presence. Must be one of: ${VALID_METRO_MANILA_PRESENCE.join(", ")}.` });
    return;
  }
  if (typeof rawAnswers.monthly_income === "string" && !/^\d+$/.test(rawAnswers.monthly_income)) {
    response.status(400).json({ error: "Bad Request", message: "monthly_income must be a non-negative whole number." });
    return;
  }
  if (typeof rawAnswers.monthly_obligations === "string" && !/^\d+$/.test(rawAnswers.monthly_obligations)) {
    response.status(400).json({ error: "Bad Request", message: "monthly_obligations must be a non-negative whole number." });
    return;
  }
  if (typeof rawAnswers.income_stability === "string" && typeof rawAnswers.income_type === "string") {
    const expectedIncomeType = ["very_stable", "stable"].includes(rawAnswers.income_stability) ? "stable" : "variable";
    if (rawAnswers.income_type !== expectedIncomeType) {
      response.status(400).json({ error: "Bad Request", message: "income_type must match income_stability." });
      return;
    }
  }
  if (typeof rawAnswers.primary_employment_classification === "string" && !VALID_EMPLOYMENT_CLASSIFICATIONS.includes(rawAnswers.primary_employment_classification)) {
    response.status(400).json({ error: "Bad Request", message: `Invalid primary_employment_classification. Must be one of: ${VALID_EMPLOYMENT_CLASSIFICATIONS.join(", ")}.` });
    return;
  }

  const { data: result, error: rpcError } = await getServiceRoleClient()
    .rpc("submit_onboarding_session", { p_session_id: sessionId, p_user_id: userId });

  if (rpcError) {
    console.error("submit_onboarding_session RPC error", {
      operation: "submit_onboarding_session",
      method: request.method,
      route: request.originalUrl,
      request_id: request.header("x-request-id")?.slice(0, 128) ?? null,
      user_id: userId,
      session_id: sessionId,
      error: rpcError,
    });
    response.status(500).json({
      error: "Internal Server Error",
      message: ONBOARDING_ERRORS.submit_failed,
    });
    return;
  }

  const rpcResult = result as { assessment_id: string; assignment_id: string; profile_label: string } | undefined;

  response.status(200).json({
    payload: {
      session: { id: sessionId, status: "submitted" },
      assessment: { id: rpcResult?.assessment_id, proposed_profile_label: rpcResult?.profile_label },
      assignment: { id: rpcResult?.assignment_id, profile_label: rpcResult?.profile_label, confirmation_required: true },
    },
  });
});

router.get("/onboarding/sessions/current", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;

  const { data: inProgress, error: inProgressError } = await authenticatedSupabase
    .from("onboarding_sessions")
    .select("id, status, started_at, submitted_at, current_step_key, raw_answers")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inProgressError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: ONBOARDING_ERRORS.session_fetch_failed,
    });
    return;
  }

  if (inProgress) {
    response.status(200).json({ payload: { session: inProgress } });
    return;
  }

  const { data: submitted, error: submittedError } = await authenticatedSupabase
    .from("onboarding_sessions")
    .select("id, status, started_at, submitted_at, current_step_key, raw_answers")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (submittedError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: ONBOARDING_ERRORS.session_fetch_failed,
    });
    return;
  }

  if (!submitted) {
    response.status(200).json({ payload: { session: null } });
    return;
  }

  response.status(200).json({ payload: { session: submitted } });
});

export default router;

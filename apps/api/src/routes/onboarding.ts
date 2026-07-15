import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { ONBOARDING_ERRORS } from "../lib/constants.js";
import { getServiceRoleClient } from "../lib/supabase.js";

const router = Router();

function validateOnboardingPayload(
  raw_answers: unknown,
  current_step_key: unknown,
): string | null {
  if (raw_answers !== undefined && (typeof raw_answers !== "object" || raw_answers === null || Array.isArray(raw_answers))) {
    return "raw_answers must be a plain object when provided.";
  }
  if (current_step_key !== undefined && typeof current_step_key !== "string") {
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
  const requiredFields = [
    "employment_status",
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
    });
    return;
  }

  const { data: result, error: rpcError } = await getServiceRoleClient()
    .rpc("submit_onboarding_session", { p_session_id: sessionId, p_user_id: userId });

  if (rpcError) {
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

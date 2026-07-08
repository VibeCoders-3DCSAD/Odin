import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getServiceRoleClient } from "../lib/supabase.js";
import { PROFILE_ERRORS, FINANCIAL_PROFILE_LABELS, PROFILE_ASSESSMENT_METHODS } from "../lib/constants.js";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function handleRpcResult(
  result: { success: boolean; code?: string } | null,
  rpcError: unknown,
  response: Response,
  errorMessage: string,
  successHandler: () => void,
): boolean {
  if (rpcError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
    });
    return false;
  }

  if (!result?.success) {
    const code = result?.code;
    if (code === "not_found") {
      response.status(404).json({
        error: "Not Found",
        message: PROFILE_ERRORS.assignment_not_found,
      });
    } else if (code === "invalid_label") {
      response.status(400).json({
        error: "Bad Request",
        message: PROFILE_ERRORS.invalid_profile_label,
      });
    } else {
      response.status(500).json({
        error: "Internal Server Error",
        message: errorMessage,
      });
    }
    return false;
  }

  successHandler();
  return true;
}

router.get("/profile/assignment/current", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;

  const { data: assignment, error: fetchError } = await authenticatedSupabase
    .from("financial_profile_assignments")
    .select("id, user_id, assessment_id, profile_label, is_active, confirmation_required, effective_from, confirmed_at, rejected_at, explanation, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (fetchError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: PROFILE_ERRORS.fetch_failed,
    });
    return;
  }

  if (!assignment) {
    response.status(200).json({ payload: { assignment: null, drivers: [] } });
    return;
  }

  if (!assignment.assessment_id) {
    response.status(200).json({ payload: { assignment, drivers: [] } });
    return;
  }

  const { data: drivers, error: driversError } = await authenticatedSupabase
    .from("financial_profile_explanation_drivers")
    .select("driver_key, driver_label, value_text, impact_label, explanation, sort_order")
    .eq("assessment_id", assignment.assessment_id)
    .order("sort_order", { ascending: true });

  if (driversError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: PROFILE_ERRORS.fetch_failed,
    });
    return;
  }

  response.status(200).json({ payload: { assignment, drivers: drivers ?? [] } });
});

router.post("/profile/assignment/confirm", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const { assignment_id, confirmation } = request.body?.payload ?? {};

  if (confirmation !== true) {
    response.status(400).json({
      error: "Bad Request",
      message: PROFILE_ERRORS.confirmation_required,
    });
    return;
  }

  if (typeof assignment_id !== "string" || !assignment_id.trim()) {
    response.status(400).json({
      error: "Bad Request",
      message: "assignment_id is required.",
    });
    return;
  }

  if (!UUID_RE.test(assignment_id.trim())) {
    response.status(400).json({
      error: "Bad Request",
      message: PROFILE_ERRORS.invalid_assignment_id,
    });
    return;
  }

  const { data: result, error: rpcError } = await getServiceRoleClient()
    .rpc("confirm_profile_assignment", {
      p_assignment_id: assignment_id.trim(),
      p_user_id: userId,
    });

  handleRpcResult(result as { success: boolean; code?: string } | null, rpcError, response, PROFILE_ERRORS.confirm_failed, () => {
    response.status(200).json({ payload: result });
  });
});

router.post("/profile/assignment/reject", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const { assignment_id, override_reason } = request.body?.payload ?? {};

  if (typeof assignment_id !== "string" || !assignment_id.trim()) {
    response.status(400).json({
      error: "Bad Request",
      message: "assignment_id is required.",
    });
    return;
  }

  if (!UUID_RE.test(assignment_id.trim())) {
    response.status(400).json({
      error: "Bad Request",
      message: PROFILE_ERRORS.invalid_assignment_id,
    });
    return;
  }

  if (typeof override_reason !== "string" || !override_reason.trim()) {
    response.status(400).json({
      error: "Bad Request",
      message: PROFILE_ERRORS.reject_reason_required,
    });
    return;
  }

  const { data: result, error: rpcError } = await getServiceRoleClient()
    .rpc("reject_profile_assignment", {
      p_assignment_id: assignment_id.trim(),
      p_user_id: userId,
      p_override_reason: override_reason.trim(),
    });

  handleRpcResult(result as { success: boolean; code?: string } | null, rpcError, response, PROFILE_ERRORS.reject_failed, () => {
    response.status(200).json({ payload: result });
  });
});

router.post("/profile/assignment/select", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const { profile_label } = request.body?.payload ?? {};

  if (typeof profile_label !== "string" || !FINANCIAL_PROFILE_LABELS.includes(profile_label as typeof FINANCIAL_PROFILE_LABELS[number])) {
    response.status(400).json({
      error: "Bad Request",
      message: PROFILE_ERRORS.invalid_profile_label,
    });
    return;
  }

  const { data: result, error: rpcError } = await getServiceRoleClient()
    .rpc("select_profile_assignment", {
      p_user_id: userId,
      p_profile_label: profile_label,
    });

  handleRpcResult(result as { success: boolean; code?: string } | null, rpcError, response, PROFILE_ERRORS.select_failed, () => {
    response.status(200).json({ payload: result });
  });
});

router.post("/profile/reassess", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const { reason, use_recent_transactions, assessment_method } = request.body?.payload ?? {};

  const method = typeof assessment_method === "string" && PROFILE_ASSESSMENT_METHODS.includes(assessment_method as typeof PROFILE_ASSESSMENT_METHODS[number])
    ? assessment_method
    : "standard";

  const metadata: Record<string, unknown> = {};
  if (typeof reason === "string" && reason.trim()) metadata.reason = reason.trim();
  if (use_recent_transactions === true || use_recent_transactions === false) {
    metadata.use_recent_transactions = use_recent_transactions;
  }

  const { data: result, error: rpcError } = await getServiceRoleClient()
    .rpc("request_profile_reassessment", {
      p_user_id: userId,
      p_assessment_method: method,
      p_metadata: metadata,
    });

  handleRpcResult(result as { success: boolean; code?: string } | null, rpcError, response, PROFILE_ERRORS.reassess_failed, () => {
    response.status(201).json({ payload: result });
  });
});

export default router;

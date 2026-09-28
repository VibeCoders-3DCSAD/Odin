import { Router } from "express";
import type { Response } from "express";

import { classifyFinancialCondition } from "../lib/mlClient.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getServiceRoleClient } from "../lib/supabase.js";

const router = Router();

router.post("/financial-classification/v2/assess", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const { data: input, error } = await getServiceRoleClient()
    .rpc("get_financial_classification_v2_input", { p_user_id: userId });
  if (error || !input || typeof input !== "object") {
    console.error("financial classification input failed", { user_id: userId, error });
    response.status(503).json({ error: "Service Unavailable", message: "Financial data is temporarily unavailable." });
    return;
  }

  const result = await classifyFinancialCondition(userId, input as Record<string, unknown>);
  if (!result.ok) {
    console.error("financial classification failed", { user_id: userId, reason: result.reason });
    response.status(503).json({ error: "Service Unavailable", message: "Financial classification is temporarily unavailable." });
    return;
  }

  const { data: assessment, error: insertError } = await getServiceRoleClient()
    .from("financial_condition_assessments")
    .insert({
      user_id: userId,
      rule_set_version: result.modelVersion,
      input_snapshot: input,
      output_snapshot: result.classification,
    })
    .select("id, assessed_at, rule_set_version, output_snapshot")
    .single();
  if (insertError) {
    console.error("financial classification persistence failed", { user_id: userId, error: insertError });
    response.status(500).json({ error: "Internal Server Error", message: "Failed to save financial classification." });
    return;
  }

  response.status(200).json({ payload: { assessment } });
});

router.get("/financial-classification/v2/latest", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const { data, error } = await request.supabase!
    .from("financial_condition_assessments")
    .select("id, assessed_at, rule_set_version, output_snapshot")
    .eq("user_id", request.userId!)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    response.status(500).json({ error: "Internal Server Error", message: "Failed to fetch financial classification." });
    return;
  }
  response.status(200).json({ payload: { assessment: data } });
});

export default router;

import { Router } from "express";
import type { Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { evaluateAlerts } from "../services/alerts/alertService.js";

const router = Router();

router.post("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  try {
    const result = await evaluateAlerts(request.supabase!, request.userId!);
    response.status(200).json({ evaluated: true, ...result });
  } catch (error) {
    console.error("Alert evaluation failed", { operation: "alert_evaluation", user_id: request.userId, error });
    response.status(500).json({ error: "Internal Server Error", message: "Alert evaluation is unavailable." });
  }
});

export default router;

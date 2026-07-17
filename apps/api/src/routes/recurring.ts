import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { runEngine, ENGINE_ERRORS } from "../services/recurringService.js";

const router = Router();

router.post("/run", async (request: Request, response: Response) => {
  const cronSecret = request.headers["x-cron-secret"];
  const configuredSecret = process.env.RECURRING_CRON_SECRET;

  if (!configuredSecret) {
    response.status(500).json({
      error: "Internal Server Error",
      message: ENGINE_ERRORS.no_cron_secret,
    });
    return;
  }

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      if (data?.user) {
        response.status(403).json({
          error: "Forbidden",
          message: ENGINE_ERRORS.user_session_rejected,
        });
        return;
      }
    }
  }

  if (!cronSecret || cronSecret !== configuredSecret) {
    response.status(403).json({
      error: "Forbidden",
      message: ENGINE_ERRORS.cron_secret_mismatch,
    });
    return;
  }

  const { as_of, limit } = request.body?.payload ?? {};

  try {
    const result = await runEngine(
      typeof as_of === "string" && as_of.trim() !== "" ? as_of.trim() : undefined,
      typeof limit === "number" && limit > 0 ? Math.floor(limit) : undefined,
    );

    response.status(200).json({ payload: result });
  } catch (error) {
    console.error("Recurring engine run failed:", error);
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to run recurring transaction engine.",
    });
  }
});

export default router;

import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { supabase } from "../lib/supabase.js";
import { runEngine, ENGINE_ERRORS } from "../services/recurringService.js";

const router = Router();

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a.normalize(), "utf-8");
  const bufB = Buffer.from(b.normalize(), "utf-8");
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function validateCronSecret(
  cronSecret: string | string[] | undefined,
  configuredSecret: string,
): boolean {
  const raw = Array.isArray(cronSecret) ? cronSecret[0] : cronSecret;
  if (!raw) return false;
  return timingSafeEqual(raw, configuredSecret);
}

router.post("/run", async (request: Request, response: Response) => {
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

  if (!validateCronSecret(request.headers["x-cron-secret"], configuredSecret)) {
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

router.post("/run/me", async (request: Request, response: Response) => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    response.status(401).json({ error: "Unauthorized", message: "Missing or invalid Bearer token." });
    return;
  }

  const token = authHeader.slice(7);
  if (!token) {
    response.status(401).json({ error: "Unauthorized", message: "Missing or invalid Bearer token." });
    return;
  }

  const { data } = await supabase.auth.getUser(token);
  if (!data?.user) {
    response.status(401).json({ error: "Unauthorized", message: "Invalid or expired token." });
    return;
  }

  try {
    const result = await runEngine(undefined, undefined, data.user.id);

    response.status(200).json({ payload: result });
  } catch (error) {
    console.error("Recurring engine run/me failed:", error);
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to run recurring transaction engine.",
    });
  }
});

export default router;

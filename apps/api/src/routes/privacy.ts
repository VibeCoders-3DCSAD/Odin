import { Router } from "express";
import type { Response } from "express";
import { PRIVACY_SETTINGS_DEFAULTS } from "../lib/constants.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

const PRIVACY_FIELDS = [
  "personalization_enabled",
  "model_training_opt_in",
  "research_evaluation_opt_in",
  "notifications_opt_in",
  "data_retention_days",
] as const;

const BOOLEAN_PRIVACY_FIELDS = PRIVACY_FIELDS.slice(0, 4);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePrivacyUpdates(payload: unknown) {
  if (!isRecord(payload)) {
    throw new Error("Payload is required");
  }

  const updates: Record<string, unknown> = {};
  const allowedFields = new Set<string>(PRIVACY_FIELDS);

  for (const [field, value] of Object.entries(payload)) {
    if (!allowedFields.has(field)) {
      throw new Error(`Unknown privacy setting: ${field}`);
    }

    if (BOOLEAN_PRIVACY_FIELDS.includes(field as (typeof BOOLEAN_PRIVACY_FIELDS)[number])) {
      if (typeof value !== "boolean") {
        throw new Error(`${field} must be a boolean`);
      }
      updates[field] = value;
      continue;
    }

    if (value !== null && (!Number.isInteger(value) || Number(value) <= 0)) {
      throw new Error("data_retention_days must be a positive integer or null");
    }
    updates[field] = value;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("At least one privacy setting is required");
  }

  return updates;
}

router.get("/settings", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;

  const { data, error } = await authenticatedSupabase
    .from("user_privacy_settings")
    .select(PRIVACY_FIELDS.join(", "))
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch privacy settings",
    });
    return;
  }

  response.status(200).json({
    payload: data ?? PRIVACY_SETTINGS_DEFAULTS,
  });
});

router.patch("/settings", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;

  let updates: Record<string, unknown>;
  try {
    updates = parsePrivacyUpdates(request.body?.payload);
  } catch (error) {
    response.status(400).json({
      error: "Bad Request",
      message: error instanceof Error ? error.message : "Invalid privacy settings payload",
    });
    return;
  }

  const { data, error } = await authenticatedSupabase
    .from("user_privacy_settings")
    .upsert(
      {
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("updated_at")
    .single();

  if (error || !data) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Privacy settings update failed",
    });
    return;
  }

  response.status(200).json({
    payload: {
      privacy_settings: {
        updated_at: data.updated_at,
      },
    },
  });
});

export default router;

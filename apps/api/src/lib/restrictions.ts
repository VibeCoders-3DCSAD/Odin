import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { VALID_RESTRICTION_LEVELS } from "./constants.js";

export type RestrictionConfig = {
  entityLabel: string;
  restrictionTable: string;
  lookupTable: string;
  entityIdField: string;
};

type RestrictionBody = {
  restriction_level: string;
  floor_amount_centavos?: unknown;
  ceiling_amount_centavos?: unknown;
  effective_from?: string;
  notes?: string;
};

export async function handleRestrictionUpsert(
  request: AuthenticatedRequest,
  response: Response,
  config: RestrictionConfig,
  entityId: string,
): Promise<boolean> {
  const userId = request.userId!;
  const supabase = request.supabase!;

  const lookupResult = await supabase
    .from(config.lookupTable)
    .select("id")
    .eq("id", entityId)
    .eq("is_active", true)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .maybeSingle();

  if (lookupResult.error) {
    response.status(500).json({ error: "Internal Server Error", message: `Failed to verify ${config.entityLabel}` });
    return false;
  }

  if (!lookupResult.data) {
    response.status(400).json({ error: "Bad Request", message: `${config.entityLabel}Id does not reference an accessible active ${config.entityLabel}` });
    return false;
  }

  const payload = request.body?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    response.status(400).json({ error: "Bad Request", message: "Request body must have a payload object" });
    return false;
  }

  const { restriction_level, floor_amount_centavos, ceiling_amount_centavos, effective_from, notes } = payload as RestrictionBody;

  if (!restriction_level || typeof restriction_level !== "string" || !VALID_RESTRICTION_LEVELS.includes(restriction_level)) {
    response.status(400).json({ error: "Bad Request", message: `restriction_level is required. Must be one of: ${VALID_RESTRICTION_LEVELS.join(", ")}` });
    return false;
  }

  if (restriction_level === "free" && ceiling_amount_centavos !== undefined && ceiling_amount_centavos !== null) {
    response.status(400).json({ error: "Bad Request", message: "ceiling_amount_centavos must be null for free restrictions" });
    return false;
  }

  if (restriction_level === "protected") {
    if (floor_amount_centavos === undefined || floor_amount_centavos === null || typeof floor_amount_centavos !== "number") {
      response.status(400).json({ error: "Bad Request", message: "floor_amount_centavos is required for protected restrictions" });
      return false;
    }
  }

  if (restriction_level === "locked") {
    if (floor_amount_centavos === undefined || floor_amount_centavos === null || typeof floor_amount_centavos !== "number") {
      response.status(400).json({ error: "Bad Request", message: "floor_amount_centavos is required for locked restrictions" });
      return false;
    }
    if (ceiling_amount_centavos === undefined || ceiling_amount_centavos === null || typeof ceiling_amount_centavos !== "number") {
      response.status(400).json({ error: "Bad Request", message: "ceiling_amount_centavos is required for locked restrictions" });
      return false;
    }
    if (floor_amount_centavos !== ceiling_amount_centavos) {
      response.status(400).json({ error: "Bad Request", message: "floor_amount_centavos and ceiling_amount_centavos must be equal for locked restrictions" });
      return false;
    }
  }

  if (floor_amount_centavos !== undefined && floor_amount_centavos !== null && typeof floor_amount_centavos === "number" && floor_amount_centavos < 0) {
    response.status(400).json({ error: "Bad Request", message: "floor_amount_centavos must be non-negative" });
    return false;
  }

  if (ceiling_amount_centavos !== undefined && ceiling_amount_centavos !== null && typeof ceiling_amount_centavos === "number" && ceiling_amount_centavos < 0) {
    response.status(400).json({ error: "Bad Request", message: "ceiling_amount_centavos must be non-negative" });
    return false;
  }

  const { data: existing, error: existingError } = await supabase
    .from(config.restrictionTable)
    .select("id")
    .eq("user_id", userId)
    .eq(config.entityIdField, entityId)
    .is("effective_to", null)
    .maybeSingle();

  if (existingError) {
    response.status(500).json({ error: "Internal Server Error", message: "Failed to check existing restriction" });
    return false;
  }

  const restrictionData: Record<string, unknown> = {
    user_id: userId,
    [config.entityIdField]: entityId,
    restriction_level,
    floor_amount_centavos: floor_amount_centavos ?? null,
    ceiling_amount_centavos: ceiling_amount_centavos ?? null,
    effective_from: effective_from || new Date().toISOString().slice(0, 10),
    notes: notes || null,
  };

  const result = existing
    ? await supabase
        .from(config.restrictionTable)
        .update(restrictionData)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("*")
        .single()
    : await supabase
        .from(config.restrictionTable)
        .insert(restrictionData)
        .select("*")
        .single();

  if (result.error) {
    response.status(500).json({ error: "Internal Server Error", message: "Failed to save restriction" });
    return false;
  }

  response.status(200).json({ payload: { restriction: result.data } });
  return true;
}

import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { VALID_RESTRICTION_LEVELS } from "../lib/constants.js";

const router = Router();

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;

    const { data: restrictions, error } = await supabase
      .from("user_subcategory_restrictions")
      .select("*, subcategories!inner(id, slug, label)")
      .eq("user_id", userId)
      .is("effective_to", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to fetch subcategory restrictions" });
      return;
    }

    response.status(200).json({ payload: { restrictions: restrictions || [] } });
  } catch (error) {
    next(error);
  }
});

router.put("/:subcategoryId", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;
    const subcategoryId = request.params.subcategoryId;

    const { data: subcat, error: subcatError } = await supabase
      .from("subcategories")
      .select("id")
      .eq("id", subcategoryId)
      .eq("is_active", true)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .maybeSingle();

    if (subcatError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to verify subcategory" });
      return;
    }

    if (!subcat) {
      response.status(400).json({ error: "Bad Request", message: "subcategoryId does not reference an accessible active subcategory" });
      return;
    }

    const payload = request.body?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      response.status(400).json({ error: "Bad Request", message: "Request body must have a payload object" });
      return;
    }

    const { restriction_level, floor_amount_centavos, ceiling_amount_centavos, effective_from, notes } = payload;

    if (!restriction_level || typeof restriction_level !== "string" || !VALID_RESTRICTION_LEVELS.includes(restriction_level)) {
      response.status(400).json({ error: "Bad Request", message: `restriction_level is required. Must be one of: ${VALID_RESTRICTION_LEVELS.join(", ")}` });
      return;
    }

    if (restriction_level === "free") {
      if (ceiling_amount_centavos !== undefined && ceiling_amount_centavos !== null) {
        response.status(400).json({ error: "Bad Request", message: "ceiling_amount_centavos must be null for free restrictions" });
        return;
      }
    }

    if (restriction_level === "protected") {
      if (floor_amount_centavos === undefined || floor_amount_centavos === null || typeof floor_amount_centavos !== "number") {
        response.status(400).json({ error: "Bad Request", message: "floor_amount_centavos is required for protected restrictions" });
        return;
      }
    }

    if (restriction_level === "locked") {
      if (floor_amount_centavos === undefined || floor_amount_centavos === null || typeof floor_amount_centavos !== "number") {
        response.status(400).json({ error: "Bad Request", message: "floor_amount_centavos is required for locked restrictions" });
        return;
      }
      if (ceiling_amount_centavos === undefined || ceiling_amount_centavos === null || typeof ceiling_amount_centavos !== "number") {
        response.status(400).json({ error: "Bad Request", message: "ceiling_amount_centavos is required for locked restrictions" });
        return;
      }
      if (floor_amount_centavos !== ceiling_amount_centavos) {
        response.status(400).json({ error: "Bad Request", message: "floor_amount_centavos and ceiling_amount_centavos must be equal for locked restrictions" });
        return;
      }
    }

    if (floor_amount_centavos !== undefined && floor_amount_centavos !== null && typeof floor_amount_centavos === "number" && floor_amount_centavos < 0) {
      response.status(400).json({ error: "Bad Request", message: "floor_amount_centavos must be non-negative" });
      return;
    }

    if (ceiling_amount_centavos !== undefined && ceiling_amount_centavos !== null && typeof ceiling_amount_centavos === "number" && ceiling_amount_centavos < 0) {
      response.status(400).json({ error: "Bad Request", message: "ceiling_amount_centavos must be non-negative" });
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from("user_subcategory_restrictions")
      .select("id")
      .eq("user_id", userId)
      .eq("subcategory_id", subcategoryId)
      .is("effective_to", null)
      .maybeSingle();

    if (existingError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to check existing restriction" });
      return;
    }

    const restrictionData = {
      user_id: userId,
      subcategory_id: subcategoryId,
      restriction_level,
      floor_amount_centavos: floor_amount_centavos ?? null,
      ceiling_amount_centavos: ceiling_amount_centavos ?? null,
      effective_from: effective_from || new Date().toISOString().slice(0, 10),
      notes: notes || null,
    };

    let result;
    if (existing) {
      result = await supabase
        .from("user_subcategory_restrictions")
        .update(restrictionData)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("*")
        .single();
    } else {
      result = await supabase
        .from("user_subcategory_restrictions")
        .insert(restrictionData)
        .select("*")
        .single();
    }

    if (result.error) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to save restriction" });
      return;
    }

    response.status(200).json({ payload: { restriction: result.data } });
  } catch (error) {
    next(error);
  }
});

export default router;

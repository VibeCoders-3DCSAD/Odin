import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { VALID_SUBCATEGORY_KINDS } from "../lib/constants.js";

const router = Router();

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;

    const includeSystem = request.query.include_system !== "false";
    const isActiveParam = request.query.is_active;
    const kind = request.query.kind;
    const categoryId = request.query.category_id;

    if (kind && typeof kind === "string" && !VALID_SUBCATEGORY_KINDS.includes(kind)) {
      response.status(400).json({
        error: "Bad Request",
        message: `Invalid kind. Must be one of: ${VALID_SUBCATEGORY_KINDS.join(", ")}`,
      });
      return;
    }

    let query = supabase
      .from("subcategories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (includeSystem) {
      query = query.or(`user_id.is.null,user_id.eq.${userId}`);
    } else {
      query = query.eq("user_id", userId);
    }

    if (isActiveParam === "true" || isActiveParam === "false") {
      query = query.eq("is_active", isActiveParam === "true");
    } else {
      query = query.eq("is_active", true);
    }

    if (kind && typeof kind === "string" && VALID_SUBCATEGORY_KINDS.includes(kind)) {
      query = query.eq("kind", kind);
    }

    if (categoryId && typeof categoryId === "string") {
      query = query.eq("category_id", categoryId);
    }

    const { data: subcategories, error } = await query;

    if (error) {
      response.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch subcategories",
      });
      return;
    }

    response.status(200).json({ payload: { subcategories: subcategories || [] } });
  } catch (error) {
    next(error);
  }
});

export default router;

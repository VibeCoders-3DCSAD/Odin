import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;

    const includeSystem = request.query.include_system !== "false";
    const isActiveParam = request.query.is_active;

    let query = supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true })
      .limit(15);

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

    const { data: categories, error } = await query;

    if (error) {
      response.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch categories",
      });
      return;
    }

    response.status(200).json({ payload: { categories: categories || [] } });
  } catch (error) {
    next(error);
  }
});

export default router;

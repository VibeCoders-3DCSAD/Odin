import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { handleRestrictionUpsert } from "../lib/restrictions.js";

const router = Router();

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;

    const { data: restrictions, error } = await supabase
      .from("user_category_restrictions")
      .select("*, categories!inner(id, slug, label)")
      .eq("user_id", userId)
      .is("effective_to", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to fetch category restrictions" });
      return;
    }

    response.status(200).json({ payload: { restrictions: restrictions || [] } });
  } catch (error) {
    next(error);
  }
});

router.put("/:categoryId", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    await handleRestrictionUpsert(request, response, {
      entityLabel: "category",
      restrictionTable: "user_category_restrictions",
      lookupTable: "categories",
      entityIdField: "category_id",
    }, request.params.categoryId);
  } catch (error) {
    next(error);
  }
});

export default router;

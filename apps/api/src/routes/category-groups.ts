import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const includeSubcategories = request.query.include_subcategories === "true";
    const userId = request.userId!;
    const supabase = request.supabase!;

    const { data: groups, error: groupsError } = await supabase
      .from("category_groups")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (groupsError) {
      response.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch category groups",
      });
      return;
    }

    if (!includeSubcategories) {
      response.status(200).json({ payload: { category_groups: groups || [] } });
      return;
    }

    const accessibleOr = `user_id.is.null,user_id.eq.${userId}`;

    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .or(accessibleOr)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (categoriesError) {
      response.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch categories",
      });
      return;
    }

    const { data: subcategories, error: subcategoriesError } = await supabase
      .from("subcategories")
      .select("*")
      .eq("is_active", true)
      .or(accessibleOr)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (subcategoriesError) {
      response.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch subcategories",
      });
      return;
    }

    const categoriesByGroupId: Record<string, typeof categories> = {};
    for (const cat of categories || []) {
      (categoriesByGroupId[cat.category_group_id] ??= []).push(cat);
    }

    const subcategoriesByCategoryId: Record<string, typeof subcategories> = {};
    for (const sub of subcategories || []) {
      (subcategoriesByCategoryId[sub.category_id] ??= []).push(sub);
    }

    const result = (groups || []).map((group) => ({
      ...group,
      categories: (categoriesByGroupId[group.id] || []).map((cat) => ({
        ...cat,
        subcategories: subcategoriesByCategoryId[cat.id] || [],
      })),
    }));

    response.status(200).json({ payload: { category_groups: result } });
  } catch (error) {
    next(error);
  }
});

export default router;

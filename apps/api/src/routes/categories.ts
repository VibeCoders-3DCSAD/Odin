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
      .limit(100);

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

router.post("/", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;

    const payload = request.body?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      response.status(400).json({
        error: "Bad Request",
        message: "Request body must have a payload object",
      });
      return;
    }

    const { category_group_id, slug, label, description, short_label, is_filipino_context, sort_order } = payload;

    if (!category_group_id || typeof category_group_id !== "string") {
      response.status(400).json({ error: "Bad Request", message: "category_group_id is required" });
      return;
    }

    if (!slug || typeof slug !== "string") {
      response.status(400).json({ error: "Bad Request", message: "slug is required" });
      return;
    }

    if (!label || typeof label !== "string") {
      response.status(400).json({ error: "Bad Request", message: "label is required" });
      return;
    }

    if (!description || typeof description !== "string") {
      response.status(400).json({ error: "Bad Request", message: "description is required" });
      return;
    }

    if (short_label !== undefined && short_label !== null && typeof short_label !== "string") {
      response.status(400).json({ error: "Bad Request", message: "short_label must be a string or null" });
      return;
    }

    if (is_filipino_context !== undefined && typeof is_filipino_context !== "boolean") {
      response.status(400).json({ error: "Bad Request", message: "is_filipino_context must be a boolean" });
      return;
    }

    if (sort_order !== undefined && typeof sort_order !== "number") {
      response.status(400).json({ error: "Bad Request", message: "sort_order must be a number" });
      return;
    }

    const { data: group, error: groupError } = await supabase
      .from("category_groups")
      .select("id")
      .eq("id", category_group_id)
      .eq("is_active", true)
      .maybeSingle();

    if (groupError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to verify category group" });
      return;
    }

    if (!group) {
      response.status(400).json({ error: "Bad Request", message: "category_group_id does not reference an active category group" });
      return;
    }

    const { data: created, error: insertError } = await supabase
      .from("categories")
      .insert({
        category_group_id,
        user_id: userId,
        slug,
        label,
        short_label: short_label || null,
        description,
        is_system: false,
        is_filipino_context: is_filipino_context === true,
        sort_order: typeof sort_order === "number" ? sort_order : 0,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        response.status(409).json({ error: "Conflict", message: "A category with this slug already exists" });
        return;
      }
      response.status(500).json({ error: "Internal Server Error", message: "Failed to create category" });
      return;
    }

    response.status(201).json({ payload: { category: created } });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;
    const categoryId = request.params.id;

    const { data: existing, error: fetchError } = await supabase
      .from("categories")
      .select("*")
      .eq("id", categoryId)
      .maybeSingle();

    if (fetchError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to fetch category" });
      return;
    }

    if (!existing) {
      response.status(404).json({ error: "Not Found", message: "Category not found" });
      return;
    }

    if (existing.is_system || existing.user_id !== userId) {
      response.status(403).json({ error: "Forbidden", message: "You can only update your own non-system categories" });
      return;
    }

    const payload = request.body?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      response.status(400).json({ error: "Bad Request", message: "Request body must have a payload object" });
      return;
    }

    const allowedFields = ["label", "short_label", "description", "is_filipino_context", "sort_order", "is_active"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        if (field === "label" || field === "description") {
          if (typeof payload[field] !== "string") {
            response.status(400).json({ error: "Bad Request", message: `${field} must be a string` });
            return;
          }
        } else if (field === "short_label") {
          if (payload[field] !== null && typeof payload[field] !== "string") {
            response.status(400).json({ error: "Bad Request", message: "short_label must be a string or null" });
            return;
          }
        } else if (field === "is_filipino_context" || field === "is_active") {
          if (typeof payload[field] !== "boolean") {
            response.status(400).json({ error: "Bad Request", message: `${field} must be a boolean` });
            return;
          }
        } else if (field === "sort_order") {
          if (typeof payload[field] !== "number") {
            response.status(400).json({ error: "Bad Request", message: "sort_order must be a number" });
            return;
          }
        }
        updates[field] = payload[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      response.status(400).json({ error: "Bad Request", message: "No valid fields to update" });
      return;
    }

    const { data: updated, error: updateError } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", categoryId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to update category" });
      return;
    }

    response.status(200).json({ payload: { category: updated } });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;
    const categoryId = request.params.id;

    const { data: existing, error: fetchError } = await supabase
      .from("categories")
      .select("*")
      .eq("id", categoryId)
      .maybeSingle();

    if (fetchError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to fetch category" });
      return;
    }

    if (!existing) {
      response.status(404).json({ error: "Not Found", message: "Category not found" });
      return;
    }

    if (existing.is_system || existing.user_id !== userId) {
      response.status(403).json({ error: "Forbidden", message: "You can only delete your own non-system categories" });
      return;
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", categoryId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (deleteError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to soft-delete category" });
      return;
    }

    response.status(200).json({ payload: { category: deleted } });
  } catch (error) {
    next(error);
  }
});

export default router;

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

router.post("/", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;

    const payload = request.body?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      response.status(400).json({ error: "Bad Request", message: "Request body must have a payload object" });
      return;
    }

    const { kind, category_id, slug, label, description, short_label, is_filipino_context, sort_order, is_protected } = payload;

    if (!kind || typeof kind !== "string" || !VALID_SUBCATEGORY_KINDS.includes(kind)) {
      response.status(400).json({ error: "Bad Request", message: `kind is required. Must be one of: ${VALID_SUBCATEGORY_KINDS.join(", ")}` });
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

    if (is_protected !== undefined && typeof is_protected !== "boolean") {
      response.status(400).json({ error: "Bad Request", message: "is_protected must be a boolean" });
      return;
    }

    if (kind === "expense") {
      if (!category_id || typeof category_id !== "string") {
        response.status(400).json({ error: "Bad Request", message: "category_id is required for expense subcategories" });
        return;
      }

      const { data: cat, error: catError } = await supabase
        .from("categories")
        .select("id")
        .eq("id", category_id)
        .eq("is_active", true)
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .maybeSingle();

      if (catError) {
        response.status(500).json({ error: "Internal Server Error", message: "Failed to verify category" });
        return;
      }

      if (!cat) {
        response.status(400).json({ error: "Bad Request", message: "category_id does not reference an accessible active category" });
        return;
      }
    } else {
      if (category_id !== undefined && category_id !== null) {
        response.status(400).json({ error: "Bad Request", message: "category_id must not be set for non-expense subcategories" });
        return;
      }
    }

    const { data: created, error: insertError } = await supabase
      .from("subcategories")
      .insert({
        category_id: kind === "expense" ? category_id : null,
        user_id: userId,
        slug,
        kind,
        label,
        short_label: short_label || null,
        description,
        is_system: false,
        is_filipino_context: is_filipino_context === true,
        is_protected_default: false,
        is_protected: is_protected === true,
        sort_order: typeof sort_order === "number" ? sort_order : 0,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        response.status(409).json({ error: "Conflict", message: "A subcategory with this slug already exists" });
        return;
      }
      response.status(500).json({ error: "Internal Server Error", message: "Failed to create subcategory" });
      return;
    }

    response.status(201).json({ payload: { subcategory: created } });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;
    const subcategoryId = request.params.id;

    const { data: existing, error: fetchError } = await supabase
      .from("subcategories")
      .select("*")
      .eq("id", subcategoryId)
      .maybeSingle();

    if (fetchError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to fetch subcategory" });
      return;
    }

    if (!existing) {
      response.status(404).json({ error: "Not Found", message: "Subcategory not found" });
      return;
    }

    if (existing.is_system || existing.user_id !== userId) {
      response.status(403).json({ error: "Forbidden", message: "You can only update your own non-system subcategories" });
      return;
    }

    const payload = request.body?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      response.status(400).json({ error: "Bad Request", message: "Request body must have a payload object" });
      return;
    }

    const allowedFields = ["label", "short_label", "description", "is_filipino_context", "is_protected", "is_active"];
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
        } else if (field === "is_filipino_context" || field === "is_protected" || field === "is_active") {
          if (typeof payload[field] !== "boolean") {
            response.status(400).json({ error: "Bad Request", message: `${field} must be a boolean` });
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
      .from("subcategories")
      .update(updates)
      .eq("id", subcategoryId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to update subcategory" });
      return;
    }

    response.status(200).json({ payload: { subcategory: updated } });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  try {
    const userId = request.userId!;
    const supabase = request.supabase!;
    const subcategoryId = request.params.id;

    const { data: existing, error: fetchError } = await supabase
      .from("subcategories")
      .select("*")
      .eq("id", subcategoryId)
      .maybeSingle();

    if (fetchError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to fetch subcategory" });
      return;
    }

    if (!existing) {
      response.status(404).json({ error: "Not Found", message: "Subcategory not found" });
      return;
    }

    if (existing.is_system || existing.user_id !== userId) {
      response.status(403).json({ error: "Forbidden", message: "You can only delete your own non-system subcategories" });
      return;
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("subcategories")
      .update({ is_active: false })
      .eq("id", subcategoryId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (deleteError) {
      response.status(500).json({ error: "Internal Server Error", message: "Failed to soft-delete subcategory" });
      return;
    }

    response.status(200).json({ payload: { subcategory: deleted } });
  } catch (error) {
    next(error);
  }
});

export default router;

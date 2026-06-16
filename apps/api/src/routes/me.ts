import { Router } from "express";
import type { Response } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, metro_manila_city")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    response.status(404).json({
      error: "Not Found",
      message: "Profile not found",
    });
    return;
  }

  const { data: privacy } = await supabase
    .from("user_privacy_settings")
    .select("personalization_enabled, notifications_opt_in")
    .eq("user_id", userId)
    .single();

  const { data: assignment } = await supabase
    .from("financial_profile_assignments")
    .select("profile_label, confirmed_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  response.status(200).json({
    payload: {
      profile: {
        display_name: profile.display_name,
        metro_manila_city: profile.metro_manila_city,
      },
      privacy_settings: {
        personalization_enabled: privacy?.personalization_enabled ?? true,
        notifications_opt_in: privacy?.notifications_opt_in ?? false,
      },
      current_profile: assignment
        ? {
            profile_label: assignment.profile_label,
            confirmed: assignment.confirmed_at !== null,
          }
        : null,
    },
  });
});

router.patch("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const { display_name, metro_manila_city } = request.body?.payload ?? {};

  if (display_name !== undefined) {
    if (display_name.length > 100) {
      response.status(400).json({
        error: "Bad Request",
        message: "Display name must not exceed 100 characters",
      });
      return;
    }
    if (display_name.trim().length === 0) {
      response.status(400).json({
        error: "Bad Request",
        message: "Display name must not be empty or whitespace only",
      });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (display_name !== undefined) updates.display_name = display_name;
  if (metro_manila_city !== undefined) updates.metro_manila_city = metro_manila_city;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select("display_name, metro_manila_city")
    .single();

  if (error) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Profile update failed",
    });
    return;
  }

  if (!data) {
    response.status(404).json({
      error: "Not Found",
      message: "Profile not found",
    });
    return;
  }

  response.status(200).json({
    payload: {
      profile: {
        display_name: data.display_name,
        metro_manila_city: data.metro_manila_city,
      },
    },
  });
});

export default router;

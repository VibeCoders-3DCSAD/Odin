import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getValidLocalityNames } from "../lib/locality-cache.js";

const router = Router();

const VALID_INCLUDE_FIELDS = ["profile", "privacy", "consents", "assignment"];

function parseIncludeParam(includeValue: unknown): Set<string> {
  if (typeof includeValue !== "string" || includeValue.trim().length === 0) {
    return new Set(["profile", "privacy", "assignment"]);
  }

  const requestedFields = includeValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const invalidField = requestedFields.find(
    (value) => !VALID_INCLUDE_FIELDS.includes(value),
  );

  if (invalidField) {
    throw new Error(`Invalid include field: ${invalidField}`);
  }

  return new Set(requestedFields);
}

router.get("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;

  let includeFields: Set<string>;
  try {
    includeFields = parseIncludeParam(request.query.include);
  } catch {
    response.status(400).json({
      error: "Bad Request",
      message: `Invalid include parameter. Must be a comma-separated subset of: ${VALID_INCLUDE_FIELDS.join(", ")}`,
    });
    return;
  }

  const payload: Record<string, unknown> = {};

  if (includeFields.has("profile")) {
    const { data: profile, error: profileError } = await authenticatedSupabase
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

    payload.profile = {
      display_name: profile.display_name,
      metro_manila_city: profile.metro_manila_city,
    };
  }

  if (includeFields.has("privacy")) {
    const { data: privacy } = await authenticatedSupabase
      .from("user_privacy_settings")
      .select("personalization_enabled, notifications_opt_in")
      .eq("user_id", userId)
      .single();

    payload.privacy_settings = {
      personalization_enabled: privacy?.personalization_enabled ?? true,
      notifications_opt_in: privacy?.notifications_opt_in ?? false,
    };
  }

  if (includeFields.has("consents")) {
    const { data: consents, error: consentsError } = await authenticatedSupabase
      .from("user_consents")
      .select("consent_kind, status, version, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(20);

    if (consentsError) {
      response.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch consents",
      });
      return;
    }

    payload.consents = consents ?? [];
  }

  if (includeFields.has("assignment")) {
    const { data: assignment } = await authenticatedSupabase
      .from("financial_profile_assignments")
      .select("profile_label, confirmed_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    payload.current_profile = assignment
      ? {
          profile_label: assignment.profile_label,
          confirmed: assignment.confirmed_at !== null,
        }
      : null;
  }

  response.status(200).json({
    payload,
  });
});

router.patch("/", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;
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

  if (metro_manila_city !== undefined) {
    if (metro_manila_city === null) {
      // Allow clearing the field.
    } else if (typeof metro_manila_city !== "string" || metro_manila_city.trim().length === 0) {
      response.status(400).json({
        error: "Bad Request",
        message: "Metro Manila city must be a non-empty string",
      });
      return;
    } else {
      let validLocalityNames: string[];
      try {
        validLocalityNames = await getValidLocalityNames();
      } catch {
        response.status(500).json({
          error: "Internal Server Error",
          message: "Failed to validate Metro Manila city",
        });
        return;
      }

      if (!validLocalityNames.includes(metro_manila_city)) {
        response.status(400).json({
          error: "Bad Request",
          message: "Invalid Metro Manila city",
        });
        return;
      }
    }
  }

  const updates: Record<string, unknown> = {};
  if (display_name !== undefined) updates.display_name = display_name;
  if (metro_manila_city !== undefined) updates.metro_manila_city = metro_manila_city;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await authenticatedSupabase
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

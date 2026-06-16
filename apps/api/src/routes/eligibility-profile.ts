import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getValidLocalities } from "../lib/locality-cache.js";
import {
  VALID_METRO_MANILA_PRESENCE,
  VALID_EMPLOYMENT_CLASSIFICATIONS,
} from "../lib/constants.js";

const router = Router();

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getEligibleBirthDateBoundary(yearsAgo: number): string {
  const now = new Date();
  return formatDateOnly(
    new Date(
      Date.UTC(
        now.getUTCFullYear() - yearsAgo,
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    ),
  );
}

router.get("/eligibility-profile", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;

  const { data: profile, error } = await authenticatedSupabase
    .from("user_eligibility_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch eligibility profile",
    });
    return;
  }

  response.status(200).json({
    payload: { profile },
  });
});

router.patch("/eligibility-profile", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;
  const {
    date_of_birth,
    is_filipino,
    metro_manila_presence,
    metro_manila_locality_code,
    primary_employment_classification,
    primary_employment_other,
  } = request.body?.payload ?? {};

  if (date_of_birth !== undefined) {
    const birthDate = new Date(date_of_birth);

    if (Number.isNaN(birthDate.getTime())) {
      response.status(400).json({
        error: "Bad Request",
        message: "Date of birth must be a valid date",
      });
      return;
    }

    const normalizedBirthDate = formatDateOnly(birthDate);
    const youngestAllowedBirthDate = getEligibleBirthDateBoundary(20);
    const oldestAllowedBirthDate = getEligibleBirthDateBoundary(40);

    if (
      normalizedBirthDate > youngestAllowedBirthDate
      || normalizedBirthDate < oldestAllowedBirthDate
    ) {
      response.status(400).json({
        error: "Bad Request",
        message: "Age must be between 20 and 40 years",
      });
      return;
    }
  }

  if (metro_manila_locality_code !== undefined) {
    let validCodes: string[];
    try {
      validCodes = await getValidLocalities(authenticatedSupabase);
    } catch {
      response.status(500).json({
        error: "Internal Server Error",
        message: "Failed to validate locality",
      });
      return;
    }

    if (!validCodes.includes(metro_manila_locality_code)) {
      response.status(400).json({
        error: "Bad Request",
        message: "Invalid metro manila locality code",
      });
      return;
    }
  }

  if (metro_manila_presence !== undefined && !VALID_METRO_MANILA_PRESENCE.includes(metro_manila_presence)) {
    response.status(400).json({
      error: "Bad Request",
      message: `Invalid metro manila presence. Must be one of: ${VALID_METRO_MANILA_PRESENCE.join(", ")}`,
    });
    return;
  }

  if (primary_employment_classification !== undefined && !VALID_EMPLOYMENT_CLASSIFICATIONS.includes(primary_employment_classification)) {
    response.status(400).json({
      error: "Bad Request",
      message: `Invalid employment classification. Must be one of: ${VALID_EMPLOYMENT_CLASSIFICATIONS.join(", ")}`,
    });
    return;
  }

  if (primary_employment_classification === "other" && !primary_employment_other) {
    response.status(400).json({
      error: "Bad Request",
      message: "Primary employment other description is required when classification is 'other'",
    });
    return;
  }

  const { data: existing, error: fetchError } = await authenticatedSupabase
    .from("user_eligibility_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch existing eligibility profile",
    });
    return;
  }

  const merged: Record<string, unknown> = {};
  if (existing) {
    for (const key of [
      "date_of_birth", "is_filipino", "metro_manila_presence",
      "metro_manila_locality_code", "primary_employment_classification",
      "primary_employment_other",
    ]) {
      merged[key] = (existing as Record<string, unknown>)[key];
    }
  }

  if (date_of_birth !== undefined) merged.date_of_birth = date_of_birth;
  if (is_filipino !== undefined) merged.is_filipino = is_filipino;
  if (metro_manila_presence !== undefined) merged.metro_manila_presence = metro_manila_presence;
  if (metro_manila_locality_code !== undefined) merged.metro_manila_locality_code = metro_manila_locality_code;
  if (primary_employment_classification !== undefined) merged.primary_employment_classification = primary_employment_classification;
  if (primary_employment_other !== undefined) merged.primary_employment_other = primary_employment_other;

  const allRequiredPresent =
    merged.date_of_birth != null &&
    merged.is_filipino === true &&
    merged.metro_manila_presence != null &&
    merged.metro_manila_locality_code != null &&
    merged.primary_employment_classification != null;

  const upsertData: Record<string, unknown> = { user_id: userId };
  for (const key of [
    "date_of_birth", "is_filipino", "metro_manila_presence",
    "metro_manila_locality_code", "primary_employment_classification",
    "primary_employment_other",
  ]) {
    if (merged[key] !== undefined) {
      upsertData[key] = merged[key];
    }
  }

  if (allRequiredPresent) {
    upsertData.eligibility_confirmed_at =
      existing?.eligibility_confirmed_at ?? new Date().toISOString();
  } else {
    upsertData.eligibility_confirmed_at = null;
  }

  upsertData.updated_at = new Date().toISOString();

  const { data, error } = await authenticatedSupabase
    .from("user_eligibility_profiles")
    .upsert(upsertData, { onConflict: "user_id" })
    .select("id, updated_at")
    .single();

  if (error) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to update eligibility profile",
    });
    return;
  }

  response.status(200).json({
    payload: {
      profile: {
        id: data.id,
        updated_at: data.updated_at,
      },
    },
  });
});

export default router;

import { Router } from "express";
import type { Request, Response } from "express";
import {
  createAuthenticatedSupabaseClient,
  supabase,
} from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

async function ensureProfile(
  userId: string,
  authenticatedSupabase = supabase,
): Promise<{ id: string }> {
  const { data: profile, error: profileError } = await authenticatedSupabase
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("id")
    .single();

  if (profileError || !profile) {
    throw new Error("Failed to create profile");
  }

  return profile;
}

async function ensurePrivacySettings(
  userId: string,
  authenticatedSupabase = supabase,
): Promise<{ personalization_enabled: boolean } | null> {
  const { data: privacy, error: privacyError } = await authenticatedSupabase
    .from("user_privacy_settings")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("personalization_enabled")
    .single();

  if (privacyError || !privacy) {
    return null;
  }

  return privacy;
}

async function bootstrapAuthenticatedUser(
  userId: string,
  accessToken: string,
): Promise<{
  user: { id: string };
  profile: { id: string };
  onboarding: { status: string };
  privacy_settings: { personalization_enabled: boolean };
}> {
  const authenticatedSupabase = createAuthenticatedSupabaseClient(accessToken);
  const profile = await ensureProfile(userId, authenticatedSupabase);
  const privacy = await ensurePrivacySettings(userId, authenticatedSupabase);

  const { data: onboarding, error: onboardingError } = await authenticatedSupabase
    .from("onboarding_sessions")
    .select("status")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (onboardingError) {
    throw new Error("Failed to fetch onboarding status");
  }

  return {
    user: { id: userId },
    profile: { id: profile.id },
    onboarding: {
      status: onboarding?.status ?? "in_progress",
    },
    privacy_settings: {
      personalization_enabled: privacy?.personalization_enabled ?? true,
    },
  };
}

router.post("/google", async (request: Request, response: Response) => {
  const googleIdToken = request.body?.payload?.googleIdToken;

  if (typeof googleIdToken !== "string" || googleIdToken.trim() === "") {
    response.status(400).json({
      error: "Bad Request",
      message: "Google ID token is required",
    });
    return;
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: googleIdToken.trim(),
  });

  if (error || !data.user || !data.session?.access_token) {
    response.status(401).json({
      error: "Unauthorized",
      message: "Google sign-in failed",
    });
    return;
  }

  let bootstrapPayload: Awaited<ReturnType<typeof bootstrapAuthenticatedUser>>;
  try {
    bootstrapPayload = await bootstrapAuthenticatedUser(
      data.user.id,
      data.session.access_token,
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Failed to bootstrap user session";
    response.status(500).json({
      error: "Internal Server Error",
      message,
    });
    return;
  }

  response.status(200).json({
    payload: {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      ...bootstrapPayload,
    },
  });
});

router.post("/session", async (request: Request, response: Response) => {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    response.status(400).json({
      error: "Bad Request",
      message: "Authorization header is required",
    });
    return;
  }

  const token = authHeader.slice(7);

  if (!token) {
    response.status(400).json({
      error: "Bad Request",
      message: "Access token is required",
    });
    return;
  }

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    response.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired access token",
    });
    return;
  }

  const userId = userData.user.id;
  let bootstrapPayload: Awaited<ReturnType<typeof bootstrapAuthenticatedUser>>;
  try {
    bootstrapPayload = await bootstrapAuthenticatedUser(userId, token);
  } catch (error) {
    const message = error instanceof Error
      && error.message === "Failed to fetch onboarding status"
        ? error.message
        : "Failed to bootstrap user profile";
    response.status(500).json({
      error: "Internal Server Error",
      message,
    });
    return;
  }

  response.status(200).json({
    payload: bootstrapPayload,
  });
});

router.post(
  "/logout",
  requireAuth,
  async (request: AuthenticatedRequest, response: Response) => {
    const { error } = await request.supabase!.auth.signOut();

    if (error) {
      response.status(500).json({
        error: "Internal Server Error",
        message: "Logout failed",
      });
      return;
    }

    response.status(200).json({
      payload: { logged_out: true },
    });
  },
);

export default router;

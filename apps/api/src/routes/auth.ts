import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

const router = Router();

router.post("/register", async (request: Request, response: Response) => {
  const { email, password, display_name } = request.body?.payload ?? {};

  if (!email) {
    response.status(400).json({
      error: "Bad Request",
      message: "Email is required",
    });
    return;
  }

  if (!password) {
    response.status(400).json({
      error: "Bad Request",
      message: "Password is required",
    });
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: display_name ? { display_name } : undefined },
  });

  if (error) {
    if (error.status === 429) {
      response.status(429).json({
        error: "Too Many Requests",
        message: error.message,
      });
      return;
    }

    if (error.status === 409) {
      response.status(409).json({
        error: "Conflict",
        message: error.message,
      });
      return;
    }

    response.status(500).json({
      error: "Internal Server Error",
      message: "Registration failed",
    });
    return;
  }

  response.status(201).json({
    payload: {
      user: { id: data.user?.id },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
      },
      activation: {
        email_confirmation_required: true,
        delivery: "email_link",
      },
    },
  });
});

async function ensureProfile(userId: string): Promise<{ id: string }> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile) return profile;

  const { data: newProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (insertError || !newProfile) {
    throw new Error("Failed to create profile");
  }

  return newProfile;
}

async function ensurePrivacySettings(userId: string): Promise<{ personalization_enabled: boolean } | null> {
  const { data: privacy, error: privacyError } = await supabase
    .from("user_privacy_settings")
    .select("personalization_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (privacy) return privacy;

  const { data: newPrivacy, error: insertError } = await supabase
    .from("user_privacy_settings")
    .insert({ user_id: userId })
    .select("personalization_enabled")
    .single();

  if (insertError || !newPrivacy) {
    return null;
  }

  return newPrivacy;
}

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

  let profile: { id: string };
  try {
    profile = await ensureProfile(userId);
  } catch {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to bootstrap user profile",
    });
    return;
  }

  const privacy = await ensurePrivacySettings(userId);

  const { data: onboarding } = await supabase
    .from("onboarding_sessions")
    .select("status")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  response.status(200).json({
    payload: {
      user: { id: userId },
      profile: { id: profile.id },
      onboarding: {
        status: onboarding?.status ?? "in_progress",
      },
      privacy_settings: {
        personalization_enabled: privacy?.personalization_enabled ?? true,
      },
    },
  });
});

router.post("/password-reset", async (request: Request, response: Response) => {
  const { email } = request.body?.payload ?? {};

  if (!email) {
    response.status(400).json({
      error: "Bad Request",
      message: "Email is required",
    });
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    if (error.status === 429) {
      response.status(429).json({
        error: "Too Many Requests",
        message: error.message,
      });
      return;
    }

    response.status(500).json({
      error: "Internal Server Error",
      message: "Password reset request failed",
    });
    return;
  }

  response.status(200).json({
    payload: { requested: true },
  });
});

router.post("/logout", async (_request: Request, response: Response) => {
  const { error } = await supabase.auth.signOut();

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
});

export default router;

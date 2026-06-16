import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { VALID_PLATFORMS } from "../lib/constants.js";

const router = Router();

router.post("/push-device-tokens", requireAuth, async (request: AuthenticatedRequest, response: Response) => {
  const userId = request.userId!;
  const authenticatedSupabase = request.supabase!;
  const { device_token, platform } = request.body?.payload ?? {};

  if (!device_token) {
    response.status(400).json({
      error: "Bad Request",
      message: "Device token is required",
    });
    return;
  }

  if (!platform) {
    response.status(400).json({
      error: "Bad Request",
      message: "Platform is required",
    });
    return;
  }

  if (!VALID_PLATFORMS.includes(platform)) {
    response.status(400).json({
      error: "Bad Request",
      message: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`,
    });
    return;
  }

  const { data, error } = await authenticatedSupabase
    .from("push_device_tokens")
    .upsert(
      {
        user_id: userId,
        device_token,
        platform,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id, device_token" },
    )
    .select("id, device_token, platform")
    .single();

  if (error) {
    response.status(500).json({
      error: "Internal Server Error",
      message: "Failed to register device token",
    });
    return;
  }

  response.status(200).json({
    payload: {
      token: {
        id: data.id,
        device_token: data.device_token,
        platform: data.platform,
      },
    },
  });
});

export default router;

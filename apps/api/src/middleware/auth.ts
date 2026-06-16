import type { Request, Response, NextFunction } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAuthenticatedSupabaseClient,
  supabase,
} from "../lib/supabase.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  accessToken?: string;
  supabase?: SupabaseClient;
}

export async function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    response.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid authorization header",
    });
    return;
  }

  const token = authHeader.slice(7);

  if (!token) {
    response.status(401).json({
      error: "Unauthorized",
      message: "Missing access token",
    });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    response.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired access token",
    });
    return;
  }

  request.userId = data.user.id;
  request.accessToken = token;
  request.supabase = createAuthenticatedSupabaseClient(token);
  next();
}

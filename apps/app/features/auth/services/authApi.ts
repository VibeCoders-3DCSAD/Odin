import { API_BASE_URL } from "../../../lib/api";
import type { AuthenticatedState, AuthProvider } from "../types";

const requestTimeoutMs = 10_000;

export type AuthPayload = {
  session?: { access_token?: string; refresh_token?: string };
  user?: { id?: string };
  onboarding?: { status?: string };
};

type AuthResponse = { payload?: AuthPayload; error?: string; code?: string; message?: string };

async function postJson(path: string, payload?: Record<string, unknown>, accessToken?: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: payload ? JSON.stringify({ payload }) : undefined,
      signal: controller.signal,
    });

    let body: AuthResponse = {};
    try {
      body = await response.json() as AuthResponse;
    } catch {
      body = {};
    }
    return { response, body };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Carries the HTTP status and API error code so screens can branch on them.
export class AuthRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

function getAuthResponseError(response: Response, body: AuthResponse, fallback: string) {
  if (body.message?.trim()) return body.message;
  if (body.code === "email_unverified") return "Verify your email first, then sign in.";
  if (response.status === 401) return "Invalid email or password.";
  if (response.status === 409) return "An account with this email already exists.";
  if (response.status === 429) return "Too many attempts. Please wait and try again.";
  if (response.status >= 500) return "The app could not complete that request. Please try again.";
  return fallback;
}

async function request(path: string, fallback: string, payload?: Record<string, unknown>, accessToken?: string) {
  const { response, body } = await postJson(path, payload, accessToken);
  if (!response.ok) throw new AuthRequestError(getAuthResponseError(response, body, fallback), response.status, body.code);
  return body.payload ?? {};
}

export function getErrorMessage(error: unknown, fallback = "Authentication failed. Please try again.") {
  if (error instanceof Error && error.name === "AbortError") {
    return "The request timed out. Check the API and try again.";
  }
  if (error instanceof TypeError || (error instanceof Error && /network|fetch/i.test(error.message))) {
    return "We could not reach Budgie. Check your internet connection and try again.";
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function buildAuthState(accessToken: string, provider: AuthProvider, payload?: AuthPayload, refreshToken?: string): AuthenticatedState {
  return {
    accessToken,
    refreshToken: refreshToken ?? payload?.session?.refresh_token,
    provider,
    userId: payload?.user?.id,
    onboardingStatus: payload?.onboarding?.status,
  };
}

export const login = (email: string, password: string) => request("/login", "Sign in failed.", { email, password });
export const register = (email: string, password: string, displayName?: string) =>
  request("/register", "Registration failed.", { email, password, display_name: displayName });
export const bootstrapSession = (accessToken: string) => request("/session", "Failed to restore your session.", undefined, accessToken);
export const verifyEmail = (accessToken: string) => request("/verify", "We could not verify your email yet.", undefined, accessToken);
export const resendVerification = (email: string) =>
  request("/verification-resend", "Verification email could not be sent.", { email });
export const requestPasswordReset = (email: string) => request("/password-reset", "Password reset failed.", { email });
export const updatePassword = (password: string, recoveryToken: string, recoveryRefreshToken: string) =>
  request("/password-update", "Password update failed.", { password, refresh_token: recoveryRefreshToken }, recoveryToken);

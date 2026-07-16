import type { AuthenticatedState } from "../components/AuthExperience";

/**
 * Local-only preview gate.
 *
 * Requires BOTH:
 * - Expo/React Native development mode (`__DEV__`)
 * - EXPO_PUBLIC_DEV_BYPASS_AUTH=true in a gitignored apps/app/.env
 *
 * Never enable this in production builds or shared branches.
 */
export const isDevAuthBypassEnabled =
  typeof __DEV__ !== "undefined"
  && __DEV__
  && process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === "true";

export const DEV_BYPASS_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEV_BYPASS_PROFILE_ID = "00000000-0000-4000-8000-000000000002";
export const DEV_BYPASS_DEVICE_ID = "dev-local-device";
export const DEV_BYPASS_ACCESS_TOKEN = "dev-bypass-access-token";

export function createDevBypassSession(): AuthenticatedState {
  return {
    accessToken: DEV_BYPASS_ACCESS_TOKEN,
    refreshToken: "dev-bypass-refresh-token",
    provider: "password",
    userId: DEV_BYPASS_USER_ID,
    profileId: DEV_BYPASS_PROFILE_ID,
    onboardingStatus: "submitted",
  };
}

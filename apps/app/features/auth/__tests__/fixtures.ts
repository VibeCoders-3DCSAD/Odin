import { OFFLINE_ACCESS_MS, resetAttempts } from "../helpers/pinPolicy";
import type { OfflineAccount } from "../types";

export const userId = "11111111-1111-4111-8111-111111111111";
export const anotherUserId = "22222222-2222-4222-8222-222222222222";
export const dataKey = "a".repeat(64);
export function accountFixture(now = Date.now()): OfflineAccount {
  return { version: 1, session: { userId,
    accessToken: "access", refreshToken: "refresh", provider: "password", onboardingStatus: "submitted" },
    verifiedAt: now, expiresAt: now + OFFLINE_ACCESS_MS, clockOffsetMs: 0, verificationRequired: false, attempts: resetAttempts(now) };
}

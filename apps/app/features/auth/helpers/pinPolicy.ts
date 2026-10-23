import type { AttemptState } from "../types";

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 60 * 60 * 1000;
export const OFFLINE_ACCESS_MS = 30 * 24 * 60 * 60 * 1000;

export function isValidPin(pin: string): boolean {
  return /^[0-9]{6}$/.test(pin);
}

export function remainingLockout(state: AttemptState, now: number): number {
  return Math.max(0, (state.lockedUntil ?? 0) - now);
}

export function recordFailedPin(state: AttemptState, now: number): AttemptState {
  if (remainingLockout(state, now) > 0) return state;
  const failedAttempts = (state.lockedUntil === null ? state.failedAttempts : 0) + 1;
  return {
    failedAttempts,
    lockedUntil: failedAttempts >= MAX_PIN_ATTEMPTS ? now + PIN_LOCKOUT_MS : null,
    lastObservedAt: Math.max(now, state.lastObservedAt),
  };
}

export function resetAttempts(now: number): AttemptState {
  return { failedAttempts: 0, lockedUntil: null, lastObservedAt: now };
}

export function needsOnlineVerification(
  account: { verifiedAt: number; expiresAt: number; attempts: AttemptState; verificationRequired?: boolean },
  now: number,
): boolean {
  return account.verificationRequired === true || !Number.isSafeInteger(now) || now < account.verifiedAt
    || now < account.attempts.lastObservedAt
    || account.expiresAt !== account.verifiedAt + OFFLINE_ACCESS_MS
    || now >= account.expiresAt;
}

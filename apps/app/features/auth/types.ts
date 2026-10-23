import type { AuthenticatedState } from "../../components/AuthExperience";

export type AccountSession = AuthenticatedState & {
  userId: string;
  profileId: string;
  onboardingStatus: string;
  refreshToken: string;
};

export type AttemptState = {
  failedAttempts: number;
  lockedUntil: number | null;
  lastObservedAt: number;
};

export type OfflineAccount = {
  version: 1;
  session: AccountSession;
  verifiedAt: number;
  expiresAt: number;
  clockOffsetMs: number;
  verificationRequired: boolean;
  attempts: AttemptState;
};

export type LocalAccount = Omit<OfflineAccount, "session"> & {
  session: Omit<AccountSession, "refreshToken">;
};

export type PinEnvelope = {
  version: 1;
  iterations: 600000;
  salt: string;
  wrappedKey: string;
};

export type AccessPhase = "hydrating" | "signed-out" | "enrollment-required"
  | "locked" | "verification-required" | "unlocked" | "recovery";

export type PinResult =
  | { status: "unlocked" }
  | { status: "incorrect"; attemptsRemaining: number }
  | { status: "locked-out"; remainingMs: number };

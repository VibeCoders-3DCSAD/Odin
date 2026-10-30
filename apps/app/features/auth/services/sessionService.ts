import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../../lib/api";
import { supabase } from "../../../lib/supabase";
import { OFFLINE_ACCESS_MS, remainingLockout, resetAttempts } from "../helpers/pinPolicy";
import { isUserId, readAccount, readRememberedOwner, removeLegacySession, writeAccount } from "./authStorage";
import { resetAccessClock } from "../helpers/accessClock";
import { withAuthLock } from "./authMutex";
import type { AccountSession, AuthenticatedState, OfflineAccount } from "../types";
import { AccessError } from "../../../lib/helpers/accessErrors";

export class OnlineVerificationError extends AccessError {
  constructor(readonly requiresLogin: boolean, message: string) { super(message); }
}

let refreshing: Promise<AccountSession> | null = null;
let renewing = false;
const EXPIRY_MARGIN_S = 60;

/** True when a JWT expires within the margin; undecodable tokens are left for the server to judge. */
export function accessTokenExpiring(token: string, now = Date.now()): boolean {
  try {
    const part = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")));
    return typeof exp === "number" && exp - EXPIRY_MARGIN_S <= now / 1000;
  } catch { return false; }
}

async function bootstrapSession(state: AuthenticatedState): Promise<OfflineAccount> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/auth/session`, {
      method: "POST", headers: { Authorization: `Bearer ${state.accessToken}` }, signal: controller.signal,
    });
    if (!response.ok) {
      const requiresLogin = response.status === 401 || response.status === 403;
      if (requiresLogin) await persistVerificationRequired();
      throw new OnlineVerificationError(requiresLogin,
        requiresLogin ? "Sign in again to verify your account." : "Account verification is temporarily unavailable.");
    }
    const body = await response.json();
    const payload = body?.payload;
    if (payload?.verified_at == null || payload?.offline_access_expires_at == null) {
      throw new AccessError("The server needs an update before sign-in can finish. Please try again once the update is complete.");
    }
    const verifiedAt = Date.parse(payload?.verified_at);
    const expiresAt = Date.parse(payload?.offline_access_expires_at);
    if (!isUserId(payload?.user?.id)
      || typeof payload?.onboarding?.status !== "string" || !state.refreshToken
      || !Number.isSafeInteger(verifiedAt) || expiresAt !== verifiedAt + OFFLINE_ACCESS_MS) {
      throw new AccessError("The server returned invalid account verification details. Please try again.");
    }
    const previous = await readAccount().catch(() => null);
    const owner = await readRememberedOwner();
    if ((previous && previous.session.userId !== payload.user.id) || (owner && owner !== payload.user.id)) {
      throw new AccessError("Sign in to the remembered account to recover access. Your local records have been preserved.");
    }
    // Rebase a running lockout onto trusted server time; verification is not a PIN reset.
    const remaining = previous ? remainingLockout(previous.attempts, verifiedAt) : 0;
    const attempts = previous ? { ...previous.attempts, lastObservedAt: verifiedAt,
      lockedUntil: remaining ? verifiedAt + remaining : previous.attempts.lockedUntil === null ? null : verifiedAt } : resetAttempts(verifiedAt);
    const session: AccountSession = { ...state, refreshToken: state.refreshToken,
      userId: payload.user.id, onboardingStatus: payload.onboarding.status };
    resetAccessClock();
    return { version: 1, session, verifiedAt, expiresAt, attempts, clockOffsetMs: verifiedAt - Date.now(), verificationRequired: false };
  } finally { clearTimeout(timeout); }
}

export async function acceptOnlineLogin(state: AuthenticatedState): Promise<OfflineAccount> {
  return withAuthLock(async () => {
    if (!state.refreshToken) throw new AccessError("Please sign in again to establish a secure session.");
    const owner = await readRememberedOwner();
    if (owner && state.userId !== owner) {
      throw new AccessError("Use the remembered account to verify access.");
    }
    const result = await supabase.auth.setSession({ access_token: state.accessToken, refresh_token: state.refreshToken });
    if (result.error || !result.data.session) throw new OnlineVerificationError(true, "Sign in again to verify your account.");
    const account = await bootstrapSession({ ...state, accessToken: result.data.session.access_token,
      refreshToken: result.data.session.refresh_token });
    await writeAccount(account);
    await removeLegacySession();
    return account;
  });
}

/** Refresh once per concurrent group. Session tokens are persisted only in the protected account record. */
export function refreshOnlineSession(renewAllowance: boolean, forceRefresh = false): Promise<AccountSession> {
  if (refreshing) return renewAllowance && !renewing
    ? refreshing.then(() => refreshOnlineSession(true)) : refreshing;
  renewing = renewAllowance;
  refreshing = withAuthLock(async () => {
    const account = await readAccount();
    if (!account) throw new OnlineVerificationError(true, "Sign in to verify your account.");
    const { accessToken, refreshToken } = account.session;
    // setSession only refreshes a fully expired token; rotate ahead of expiry or after a server rejection.
    const result = forceRefresh || accessTokenExpiring(accessToken)
      ? await supabase.auth.refreshSession({ refresh_token: refreshToken })
      : await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (result.error || !result.data.session) {
      const status = result.error && "status" in result.error ? result.error.status : undefined;
      const requiresLogin = status === 400 || status === 401 || status === 403;
      if (requiresLogin) await persistVerificationRequired();
      throw new OnlineVerificationError(requiresLogin,
        "Connect to the internet and verify your account.");
    }
    const session: AccountSession = { ...account.session, accessToken: result.data.session.access_token,
      refreshToken: result.data.session.refresh_token };
    // Save rotated credentials before any subsequent network call can fail.
    await writeAccount({ ...account, session });
    if (renewAllowance) {
      const verified = await bootstrapSession(session);
      await writeAccount(verified);
    }
    return session;
  }).finally(() => { refreshing = null; renewing = false; });
  return refreshing;
}

// Caller holds the auth mutex; a confirmed denial must survive an offline restart.
async function persistVerificationRequired(): Promise<void> {
  try {
    const account = await readAccount();
    if (account) await writeAccount({ ...account, verificationRequired: true });
  } catch {
    throw new OnlineVerificationError(true, "Sign in online to restore secure account access.");
  }
}

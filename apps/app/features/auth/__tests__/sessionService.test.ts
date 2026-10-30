jest.mock("expo-secure-store", () => {
  const values = new Map();
  return { WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device",
    getItemAsync: jest.fn(async (key) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key) => { values.delete(key); }) };
});
jest.mock("../../../lib/supabase", () => ({ supabase: { auth: { setSession: jest.fn(), refreshSession: jest.fn() } } }));
jest.mock("../../../lib/api", () => ({ API_BASE_URL: "https://odin.test", REQUEST_TIMEOUT_MS: 10000 }));

import { supabase } from "../../../lib/supabase";
import { OFFLINE_ACCESS_MS, PIN_LOCKOUT_MS } from "../helpers/pinPolicy";
import { clearRememberedAccount, readAccount, writeAccount } from "../services/authStorage";
import { acceptOnlineLogin, accessTokenExpiring, refreshOnlineSession } from "../services/sessionService";
import { accountFixture, anotherUserId } from "./fixtures";

describe("online verification", () => {
  const now = 1_800_000_000_000;
  const fetchMock = jest.fn();
  beforeEach(async () => {
    jest.spyOn(Date, "now").mockReturnValue(now);
    jest.clearAllMocks();
    global.fetch = fetchMock;
    await writeAccount(accountFixture(now));
    const user = { id: accountFixture(now).session.userId, aud: "authenticated", created_at: new Date(now).toISOString(), app_metadata: {}, user_metadata: {} };
    const rotated = { data: {
      user, session: { access_token: "rotated-access", refresh_token: "rotated-refresh", expires_in: 3600,
        token_type: "bearer", user },
    }, error: null };
    jest.mocked(supabase.auth.setSession).mockResolvedValue(rotated);
    jest.mocked(supabase.auth.refreshSession).mockResolvedValue(rotated);
  });
  afterEach(() => jest.restoreAllMocks());

  function verifiedResponse(verifiedAt: number) {
    const session = accountFixture(now).session;
    return { ok: true, status: 200, json: async () => ({ payload: { user: { id: session.userId },
      onboarding: { status: "submitted" },
      verified_at: new Date(verifiedAt).toISOString(),
      offline_access_expires_at: new Date(verifiedAt + OFFLINE_ACCESS_MS).toISOString() } }) };
  }

  it("explains an outdated API response on a fresh login without saving offline access", async () => {
    await clearRememberedAccount();
    const session = accountFixture(now).session;
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ payload: {
      user: { id: session.userId },
      onboarding: { status: "submitted" },
    } }) });
    await expect(acceptOnlineLogin(session)).rejects.toThrow(
      "The server needs an update before sign-in can finish. Please try again once the update is complete.",
    );
    expect(await readAccount()).toBeNull();
  });

  it("accepts a fresh login with server-verified offline access", async () => {
    await clearRememberedAccount();
    fetchMock.mockResolvedValue(verifiedResponse(now));
    await acceptOnlineLogin(accountFixture(now).session);
    expect((await readAccount())?.expiresAt).toBe(now + OFFLINE_ACCESS_MS);
  });

  it("rejects an invalid server allowance without saving offline access", async () => {
    await clearRememberedAccount();
    const response = verifiedResponse(now);
    const body = await response.json();
    body.payload.offline_access_expires_at = new Date(now + OFFLINE_ACCESS_MS + 1000).toISOString();
    fetchMock.mockResolvedValue({ ...response, json: async () => body });
    await expect(acceptOnlineLogin(accountFixture(now).session)).rejects.toThrow(
      "The server returned invalid account verification details. Please try again.",
    );
    expect(await readAccount()).toBeNull();
  });

  it("preserves account and allowance on network failure while retaining rotated tokens", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await expect(refreshOnlineSession(true)).rejects.toThrow();
    const account = await readAccount();
    expect(account?.expiresAt).toBe(now + OFFLINE_ACCESS_MS);
    expect(account?.session.refreshToken).toBe("rotated-refresh");
  });

  it("renews for 30 days from server time without clearing an active lockout", async () => {
    const account = accountFixture(now);
    account.attempts = { failedAttempts: 5, lockedUntil: now + PIN_LOCKOUT_MS, lastObservedAt: now };
    await writeAccount(account);
    fetchMock.mockResolvedValue(verifiedResponse(now + 1000));
    await refreshOnlineSession(true);
    const renewed = await readAccount();
    expect(renewed?.expiresAt).toBe(now + 1000 + OFFLINE_ACCESS_MS);
    expect(renewed?.attempts.failedAttempts).toBe(5);
    expect(renewed?.attempts.lockedUntil).toBe(now + PIN_LOCKOUT_MS);
  });

  it("does not renew on an ordinary token refresh", async () => {
    await refreshOnlineSession(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await readAccount())?.expiresAt).toBe(now + OFFLINE_ACCESS_MS);
  });

  const jwt = (exp: number) => `h.${btoa(JSON.stringify({ exp })).replace(/=+$/, "")}.s`;

  it("treats a token inside the expiry margin as expiring", () => {
    expect(accessTokenExpiring(jwt(now / 1000 + 30), now)).toBe(true);
    expect(accessTokenExpiring(jwt(now / 1000 + 600), now)).toBe(false);
    expect(accessTokenExpiring("not-a-jwt", now)).toBe(false);
  });

  it("refreshes an expiring token instead of reusing it", async () => {
    await writeAccount({ ...accountFixture(now), session: { ...accountFixture(now).session, accessToken: jwt(now / 1000 - 1) } });
    await expect(refreshOnlineSession(false)).resolves.toMatchObject({ accessToken: "rotated-access" });
    expect(supabase.auth.refreshSession).toHaveBeenCalledWith({ refresh_token: "refresh" });
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
    expect((await readAccount())?.session.refreshToken).toBe("rotated-refresh");
  });

  it("forces a refresh after the server rejects an unexpired token", async () => {
    await refreshOnlineSession(false, true);
    expect(supabase.auth.refreshSession).toHaveBeenCalledWith({ refresh_token: "refresh" });
  });

  it("rejects wrong-account reauthentication before replacing the remembered session", async () => {
    await expect(acceptOnlineLogin({ ...accountFixture(now).session, userId: anotherUserId })).rejects.toThrow();
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it("requires login for confirmed rejection but preserves records", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(refreshOnlineSession(true)).rejects.toMatchObject({ requiresLogin: true });
    expect(await readAccount()).not.toBeNull();
    expect((await readAccount())?.verificationRequired).toBe(true);
  });
});

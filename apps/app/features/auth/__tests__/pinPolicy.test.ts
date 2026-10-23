import { isValidPin, needsOnlineVerification, OFFLINE_ACCESS_MS, PIN_LOCKOUT_MS,
  recordFailedPin, remainingLockout, resetAttempts } from "../helpers/pinPolicy";

describe("offline access policies", () => {
  test.each(["12345", "1234567", "１２３４５６", "12345a", " 123456"])("rejects %s", (pin) => {
    expect(isValidPin(pin)).toBe(false);
  });
  it("preserves leading zeroes", () => expect(isValidPin("001234")).toBe(true));
  it("locks after exactly five failures and grants a fresh budget after one hour", () => {
    const now = 1_000_000;
    let state = resetAttempts(now);
    for (let attempt = 1; attempt <= 4; attempt++) {
      state = recordFailedPin(state, now);
      expect(state.failedAttempts).toBe(attempt);
      expect(state.lockedUntil).toBeNull();
    }
    state = recordFailedPin(state, now);
    expect(state.lockedUntil).toBe(now + PIN_LOCKOUT_MS);
    expect(remainingLockout(state, now + PIN_LOCKOUT_MS - 1)).toBe(1);
    expect(recordFailedPin(state, now + PIN_LOCKOUT_MS - 1)).toEqual(state);
    expect(recordFailedPin(state, now + PIN_LOCKOUT_MS)).toEqual({
      failedAttempts: 1, lockedUntil: null, lastObservedAt: now + PIN_LOCKOUT_MS,
    });
  });
  it("expires at exactly 30 days and detects rollback", () => {
    const verifiedAt = 1_000_000;
    const account = { verifiedAt, expiresAt: verifiedAt + OFFLINE_ACCESS_MS,
      attempts: resetAttempts(verifiedAt + 100) };
    expect(needsOnlineVerification(account, account.expiresAt - 1)).toBe(false);
    expect(needsOnlineVerification(account, account.expiresAt)).toBe(true);
    expect(needsOnlineVerification(account, verifiedAt + 99)).toBe(true);
    expect(needsOnlineVerification({ ...account, expiresAt: account.expiresAt + 1 }, verifiedAt + 100)).toBe(true);
  });
});

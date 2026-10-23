import { AccessError } from "../../../lib/helpers/accessErrors";
import * as SecureStore from "expo-secure-store";
import { OFFLINE_ACCESS_MS } from "../helpers/pinPolicy";
import type { OfflineAccount, PinEnvelope } from "../types";
import { readSecret, writeSecret, secureStorageOptions } from "../../../lib/helpers/secureStorage";
export { readSecret, writeSecret };

const ACCOUNT_KEY = "odin.auth.account.v1";
const OWNER_KEY = "odin.auth.owner.v1";
const options = secureStorageOptions;
export const isUserId = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseAccount(raw: string): OfflineAccount {
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !object(value.session) || !object(value.attempts)) {
    throw new AccessError("Saved account needs online recovery.");
  }
  const { session, attempts } = value;
  if (!isUserId(session.userId) || !isUserId(session.profileId)
    || !["password", "google"].includes(String(session.provider))
    || typeof session.accessToken !== "string" || !session.accessToken
    || typeof session.refreshToken !== "string" || !session.refreshToken
    || typeof session.onboardingStatus !== "string"
    || !timestamp(value.verifiedAt) || !timestamp(value.expiresAt)
    || value.expiresAt !== value.verifiedAt + OFFLINE_ACCESS_MS
    || typeof value.clockOffsetMs !== "number" || !Number.isSafeInteger(value.clockOffsetMs)
    || typeof value.verificationRequired !== "boolean"
    || !timestamp(attempts.lastObservedAt)
    || typeof attempts.failedAttempts !== "number" || !Number.isInteger(attempts.failedAttempts)
    || attempts.failedAttempts < 0 || attempts.failedAttempts > 5
    || !(attempts.lockedUntil === null || timestamp(attempts.lockedUntil))
    || (attempts.failedAttempts === 5) !== (attempts.lockedUntil !== null)) {
    throw new AccessError("Saved account needs online recovery.");
  }
  return value as OfflineAccount;
}

export async function readAccount(): Promise<OfflineAccount | null> {
  const raw = await SecureStore.getItemAsync(ACCOUNT_KEY, options);
  return raw ? parseAccount(raw) : null;
}

export async function writeAccount(account: OfflineAccount): Promise<void> {
  const raw = JSON.stringify(account);
  parseAccount(raw);
  await SecureStore.setItemAsync(OWNER_KEY, account.session.userId, options);
  await SecureStore.setItemAsync(ACCOUNT_KEY, raw, options);
}

export async function readRememberedOwner(): Promise<string | null> {
  const value = await SecureStore.getItemAsync(OWNER_KEY, options);
  if (value !== null && !isUserId(value)) throw new AccessError("Saved account identity is invalid.");
  return value;
}

export async function readEnvelope(userId: string): Promise<PinEnvelope | null> {
  const raw = await readSecret(userId, "pin.v1");
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || value.iterations !== 600000
    || typeof value.salt !== "string" || !/^[0-9a-f]{32}$/.test(value.salt)
    || typeof value.wrappedKey !== "string" || !/^[A-Za-z0-9+/=]{80,160}$/.test(value.wrappedKey)) {
    throw new AccessError("PIN protection needs online recovery.");
  }
  return value as PinEnvelope;
}

export async function clearRememberedAccount(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCOUNT_KEY, options);
  await SecureStore.deleteItemAsync(OWNER_KEY, options);
  await SecureStore.deleteItemAsync("odin.auth.session");
}

export async function readLegacySession(): Promise<unknown> {
  const raw = await SecureStore.getItemAsync("odin.auth.session");
  return raw ? JSON.parse(raw) : null;
}

export async function removeLegacySession(): Promise<void> {
  await SecureStore.deleteItemAsync("odin.auth.session");
}

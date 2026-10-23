jest.mock("expo-crypto", () => {
  const crypto = require("node:crypto");
  return {
    getRandomBytesAsync: async (length: number) => new Uint8Array(crypto.randomBytes(length)),
    AESEncryptionKey: { import: async (bytes: Uint8Array) => Buffer.from(bytes) },
    AESSealedData: { fromCombined: (value: Uint8Array) => {
      // SDK 55 Android requires a byte array here; unlike iOS, it rejects base64 strings.
      if (!(value instanceof Uint8Array)) throw new TypeError("Expected Uint8Array");
      return Buffer.from(value);
    } },
    aesEncryptAsync: async (bytes: Uint8Array, key: Buffer) => {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
      const sealed = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
      return { combined: async () => sealed.toString("base64") };
    },
    aesDecryptAsync: async (sealed: Buffer, key: Buffer) => {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, sealed.subarray(0, 12));
      decipher.setAuthTag(sealed.subarray(-16));
      return new Uint8Array(Buffer.concat([decipher.update(sealed.subarray(12, -16)), decipher.final()]));
    },
  };
});
jest.mock("expo", () => ({
  requireOptionalNativeModule: () => ({
    deriveKeyAsync: (password: string, saltHex: string, iterations: number) => new Promise((resolve, reject) => {
      require("node:crypto").pbkdf2(password, Buffer.from(saltHex, "hex"), iterations, 32, "sha256",
        (error: Error | null, key: Buffer) => error ? reject(error) : resolve(key.toString("hex")));
    }),
  }),
}));
jest.mock("expo-secure-store", () => {
  const values = new Map();
  return { WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device",
    getItemAsync: jest.fn(async (key) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key) => { values.delete(key); }) };
});
jest.mock("../../../local-db/client", () => ({ closeDatabase: jest.fn(), initDatabase: jest.fn() }));

import { createSecret, unwrapKey, wrapKey } from "../services/pinCrypto";
import { derivePinKey } from "../services/nativePinKey";
import { enrollPin, lockVault, unlockWithPin } from "../services/pinVault";
import { readAccount, readSecret, writeAccount } from "../services/authStorage";
import { accountFixture, userId } from "./fixtures";
import { AESSealedData } from "expo-crypto";

describe("PIN key wrapping using real PBKDF2 and AES-GCM", () => {
  jest.setTimeout(30000);
  it("keeps existing PIN envelopes compatible with PBKDF2-HMAC-SHA256", async () => {
    expect(await derivePinKey("001234", "a".repeat(64), "b".repeat(32)))
      .toBe("02eaf99478d7e622d56ddee11d737a5c30c0e1bfdf133fdc6cf929ebceef4938");
  });
  it("allows UI timers to run while deriving the PIN key", async () => {
    let timerRan = false;
    const timer = setTimeout(() => { timerRan = true; }, 0);
    try {
      await wrapKey("001234", "a".repeat(64), "b".repeat(64));
      expect(timerRan).toBe(true);
    } finally { clearTimeout(timer); }
  });
  it("unwraps only with the matching PIN and device secret, with unique salts and nonces", async () => {
    const key = await createSecret();
    const secret = await createSecret();
    const first = await wrapKey("001234", secret, key);
    const second = await wrapKey("001234", secret, key);
    expect(first.salt).not.toBe(second.salt);
    expect(first.wrappedKey).not.toBe(second.wrappedKey);
    expect(await unwrapKey("001234", secret, first)).toBe(key);
    expect(await unwrapKey("001235", secret, first)).toBeNull();
    expect(await unwrapKey("001234", await createSecret(), first)).toBeNull();
    const tampered = { ...first, wrappedKey: `${first.wrappedKey[0] === "A" ? "B" : "A"}${first.wrappedKey.slice(1)}` };
    expect(await unwrapKey("001234", secret, tampered)).toBeNull();
  });

  it("unlocks with the replacement PIN after reset, clears attempts, and preserves the data key", async () => {
    await writeAccount(accountFixture());
    await enrollPin(userId, "123456");
    const originalKey = await readSecret(userId, "recovery-key");
    await lockVault();
    await unlockWithPin(userId, "999999");
    await unlockWithPin(userId, "999999");
    expect((await readAccount())?.attempts.failedAttempts).toBe(2);

    // The recovery service receives this only after same-account online reauthentication.
    await enrollPin(userId, "001234", true);
    expect((await readAccount())?.attempts.failedAttempts).toBe(0);
    expect((await readSecret(userId, "recovery-key")) === originalKey).toBe(true);
    await lockVault();
    expect(await unlockWithPin(userId, "001234")).toEqual({ status: "unlocked" });
    await lockVault();
    expect(await unlockWithPin(userId, "123456")).toEqual({ status: "incorrect", attemptsRemaining: 4 });
    expect(await unlockWithPin(userId, "001234")).toEqual({ status: "unlocked" });
    expect((await readAccount())?.attempts.failedAttempts).toBe(0);
    await lockVault();
  });

  it("does not classify a native envelope conversion failure as an incorrect PIN", async () => {
    const envelope = await wrapKey("001234", "a".repeat(64), "b".repeat(64));
    const fromCombined = jest.spyOn(AESSealedData, "fromCombined").mockImplementationOnce(() => {
      throw new TypeError("Native input conversion failed");
    });
    try {
      await expect(unwrapKey("001234", "a".repeat(64), envelope)).rejects.toThrow("Native input conversion failed");
    } finally { fromCombined.mockRestore(); }
  });
});

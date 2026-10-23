import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { toByteArray } from "base64-js";
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytesAsync } from "expo-crypto";
import type { PinEnvelope } from "../types";
import { derivePinKey } from "./nativePinKey";
import { tracePinStep } from "../../../lib/helpers/pinSetupTrace";

export const createSecret = async () => bytesToHex(await getRandomBytesAsync(32));

async function deriveKey(pin: string, deviceSecret: string, salt: string) {
  const bytes = hexToBytes(await derivePinKey(pin, deviceSecret, salt));
  try { return await tracePinStep("crypto.import-aes-key", () => AESEncryptionKey.import(bytes)); }
  finally { bytes.fill(0); }
}

export async function wrapKey(pin: string, deviceSecret: string, dataKey: string): Promise<PinEnvelope> {
  const salt = bytesToHex(await tracePinStep("crypto.generate-salt", () => getRandomBytesAsync(16)));
  const key = await deriveKey(pin, deviceSecret, salt);
  const sealed = await tracePinStep("crypto.wrap-aes-gcm", () => aesEncryptAsync(hexToBytes(dataKey), key));
  const wrappedKey = await tracePinStep("crypto.encode-envelope", () => sealed.combined("base64"));
  return { version: 1, iterations: 600000, salt, wrappedKey };
}

export async function unwrapKey(pin: string, deviceSecret: string, envelope: PinEnvelope): Promise<string | null> {
  const key = await deriveKey(pin, deviceSecret, envelope.salt);
  // SDK 55 Android's native fromCombined accepts Uint8Array, despite the JS API
  // advertising base64 strings. Conversion failures are not incorrect PINs.
  const sealed = await tracePinStep("crypto.decode-envelope", () => AESSealedData.fromCombined(toByteArray(envelope.wrappedKey)));
  try {
    const bytes = await tracePinStep("crypto.unwrap-aes-gcm", () => aesDecryptAsync(sealed, key));
    if (bytes.length !== 32) return null;
    const result = bytesToHex(bytes);
    bytes.fill(0);
    return result;
  } catch {
    // GCM authentication failure is an incorrect PIN; never expose native errors.
    return null;
  }
}

import * as SecureStore from "expo-secure-store";

export const secureStorageOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

function keyFor(userId: string, suffix: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Invalid account identity.");
  }
  return `odin.auth.${userId}.${suffix}`;
}

export const readSecret = (userId: string, suffix: string) => SecureStore.getItemAsync(keyFor(userId, suffix), secureStorageOptions);
export const writeSecret = (userId: string, suffix: string, value: string) => SecureStore.setItemAsync(keyFor(userId, suffix), value, secureStorageOptions);

const LEGACY_ARCHIVE_KEY = "odin.auth.legacy-archive-key.v1";
export const readLegacyArchiveKey = () => SecureStore.getItemAsync(LEGACY_ARCHIVE_KEY, secureStorageOptions);
export const writeLegacyArchiveKey = (key: string) => SecureStore.setItemAsync(LEGACY_ARCHIVE_KEY, key, secureStorageOptions);

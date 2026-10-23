let protectionEnabled = false;
let credentials: { userId: string; key: string } | null = null;

export function enableDatabaseProtection(): void { protectionEnabled = true; }

export function setDatabaseCredentials(value: { userId: string; key: string } | null): void {
  if (value && (!/^[0-9a-f-]{36}$/i.test(value.userId) || !/^[0-9a-f]{64}$/.test(value.key))) {
    throw new Error("Invalid database credentials.");
  }
  credentials = value;
}

export function getDatabaseCredentials() {
  if (protectionEnabled && !credentials) throw new Error("Unlock Budgie to access local data.");
  return protectionEnabled ? credentials : null;
}

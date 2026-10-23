import * as SQLite from "expo-sqlite";
import { File } from "expo-file-system";
import { readSecret, writeSecret, readLegacyArchiveKey, writeLegacyArchiveKey } from "../lib/helpers/secureStorage";
import { AccessError } from "../lib/helpers/accessErrors";
import { tracePinStep } from "../lib/helpers/pinSetupTrace";

function fileFor(name: string): File {
  const directory = SQLite.defaultDatabaseDirectory;
  if (!directory || (!directory.startsWith("/") && !directory.startsWith("file:///"))) {
    throw new AccessError("The local database location is unavailable. Your saved records are safe.");
  }
  // Android SQLite supplies a filesystem path, while FileSystem expects a file URI.
  const uri = directory.startsWith("file:///") ? directory : `file://${directory}`;
  return new File(uri, name);
}

function keySql(key: string): string {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error("Invalid database key.");
  return `"x'${key}'"`;
}

async function verifyIntegrity(database: SQLite.SQLiteDatabase): Promise<void> {
  const check = await tracePinStep("database.integrity-check", () => database.getFirstAsync<{ integrity_check: string }>("PRAGMA integrity_check"));
  if (check?.integrity_check !== "ok") throw new Error("Local data integrity check failed.");
  await tracePinStep("database.read-schema", () => database.getAllAsync("SELECT name FROM sqlite_master"));
}

async function openWithKey(name: string, key: string): Promise<SQLite.SQLiteDatabase> {
  const role = name.includes(".migrating") ? "staging" : name.startsWith("odin-legacy-") ? "archive" : "account";
  const database = await tracePinStep(`database.${role}.open`, () => SQLite.openDatabaseAsync(name));
  try {
    const cipher = await tracePinStep(`database.${role}.check-cipher`, () => database.getFirstAsync<{ cipher_version?: string }>("PRAGMA cipher_version"));
    if (!cipher?.cipher_version) throw new AccessError("A new Budgie native build is required for encrypted storage.");
    await tracePinStep(`database.${role}.apply-key`, () => database.execAsync(`PRAGMA key = ${keySql(key)}`));
    await verifyIntegrity(database);
    return database;
  } catch (error) {
    await tracePinStep(`database.${role}.close-after-failure`, () => database.closeAsync());
    throw error;
  }
}

async function rowCounts(database: SQLite.SQLiteDatabase, schema: "main" | "encrypted") {
  const tables = await database.getAllAsync<{ name: string }>(
    `SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  const selects = tables.map(({ name }) => {
    const identifier = `"${name.replace(/"/g, '""')}"`;
    const literal = `'${name.replace(/'/g, "''")}'`;
    return `SELECT ${literal} AS name, COUNT(*) AS count FROM ${schema}.${identifier}`;
  });
  if (!selects.length) return {};
  const rows = await database.getAllAsync<{ name: string; count: number }>(selects.join(" UNION ALL "));
  return Object.fromEntries(rows.map(({ name, count }) => [name, count]));
}

function removeLegacyFiles(): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = fileFor(`odin.db${suffix}`);
    if (file.exists) file.delete();
  }
}

/** Export first, verify, then activate. An interrupted export never replaces the source. */
export async function openEncryptedDatabase(userId: string, key: string): Promise<SQLite.SQLiteDatabase> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid account identity.");
  const name = `odin-${userId}.db`;
  if (await tracePinStep("database.inspect-account-file", () => fileFor(name).exists)) {
    const active = await openWithKey(name, key);
    try {
      if (await readSecret(userId, "legacy-migration") === "verified") {
        removeLegacyFiles();
        await writeSecret(userId, "legacy-migration", "complete");
      }
      return active;
    } catch (error) { await active.closeAsync(); throw error; }
  }
  const fromLegacy = await tracePinStep("database.inspect-legacy-file", () => fileFor("odin.db").exists);
  const archiveName = "odin-legacy-encrypted-v1.db";
  const archiveKey = await tracePinStep("database.read-archive-key", readLegacyArchiveKey);
  if (!fromLegacy && !fileFor(archiveName).exists) return openWithKey(name, key);
  if (!fromLegacy && !archiveKey) throw new AccessError("The encrypted upgrade archive needs recovery. Your records have been preserved.");

  const stagingName = `${name}.migrating`;
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = fileFor(`${stagingName}${suffix}`);
    if (file.exists) file.delete();
  }
  // Check cipher availability before opening or changing the legacy database.
  const staging = await openWithKey(stagingName, key);
  await staging.closeAsync();
  fileFor(stagingName).delete();
  const source = await tracePinStep("migration.open-source", () => fromLegacy ? SQLite.openDatabaseAsync("odin.db") : openWithKey(archiveName, archiveKey!));
  try {
    await tracePinStep("migration.checkpoint", () => source.execAsync("PRAGMA wal_checkpoint(TRUNCATE)"));
    await verifyIntegrity(source);
    const before = await tracePinStep("migration.count-source-rows", () => rowCounts(source, "main"));
    const targetPath = fileFor(stagingName).uri.replace(/^file:\/\//, "").replace(/'/g, "''");
    await tracePinStep("migration.attach-encrypted-target", () => source.execAsync(`ATTACH DATABASE '${targetPath}' AS encrypted KEY ${keySql(key)}`));
    try {
      await tracePinStep("migration.sqlcipher-export", () => source.getFirstAsync("SELECT sqlcipher_export('encrypted')"));
      const after = await tracePinStep("migration.count-encrypted-rows", () => rowCounts(source, "encrypted"));
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Encrypted migration verification failed.");
    } finally {
      await tracePinStep("migration.detach-encrypted-target", () => source.execAsync("DETACH DATABASE encrypted"));
    }
  } finally {
    await tracePinStep("migration.close-source", () => source.closeAsync());
  }
  const verified = await openWithKey(stagingName, key);
  await verified.closeAsync();
  if (fromLegacy && !fileFor(archiveName).exists) {
    // The old shared DB can contain another account's unsynced rows. Retain an encrypted
    // snapshot for that account's first verified enrollment instead of stranding its queue.
    await tracePinStep("migration.save-archive-key", () => writeLegacyArchiveKey(key));
    const copyName = `${archiveName}.copying`;
    if (fileFor(copyName).exists) fileFor(copyName).delete();
    await tracePinStep("migration.copy-encrypted-archive", () => fileFor(stagingName).copy(fileFor(copyName)));
    const archive = await openWithKey(copyName, key);
    await archive.closeAsync();
    fileFor(copyName).move(fileFor(archiveName));
  } else if (fromLegacy) {
    if (!archiveKey) throw new AccessError("The encrypted archive key is unavailable. Your original records are safe.");
    const archive = await openWithKey(archiveName, archiveKey);
    await archive.closeAsync();
  }
  await tracePinStep("migration.save-verified-marker", () => writeSecret(userId, "legacy-migration", "verified"));
  await tracePinStep("migration.activate-encrypted-database", () => fileFor(stagingName).move(fileFor(name)));
  const active = await openWithKey(name, key);
  // User confirms the encryption migration during enrollment. No financial rows are discarded.
  try {
    removeLegacyFiles();
    await writeSecret(userId, "legacy-migration", "complete");
    return active;
  } catch (error) { await active.closeAsync(); throw error; }
}

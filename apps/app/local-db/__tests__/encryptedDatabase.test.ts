jest.mock("expo-sqlite", () => ({ defaultDatabaseDirectory: "/tmp/odin", openDatabaseAsync: jest.fn() }));
jest.mock("expo-file-system", () => {
  const files = new Set(["/tmp/odin/odin.db"]);
  const diskPath = (uri: string) => decodeURIComponent(new URL(uri).pathname);
  return { resetFiles: (paths: string[]) => { files.clear(); paths.forEach((path) => files.add(path)); },
    File: class {
    uri: string;
    constructor(...parts: string[]) {
      if (!parts[0]?.startsWith("file://")) throw new Error("URI is not absolute");
      this.uri = parts.join("/");
    }
    get exists() { return files.has(diskPath(this.uri)); }
    delete() { files.delete(diskPath(this.uri)); }
    copy(other: { uri: string }) { files.add(diskPath(other.uri)); }
    move(other: { uri: string }) { files.delete(diskPath(this.uri)); files.add(diskPath(other.uri)); }
  } };
});
jest.mock("../../lib/helpers/secureStorage", () => ({ readSecret: jest.fn(async () => null), writeSecret: jest.fn(),
  readLegacyArchiveKey: jest.fn(async () => "a".repeat(64)), writeLegacyArchiveKey: jest.fn() }));

import * as SQLite from "expo-sqlite";
import { File } from "expo-file-system";
import { openEncryptedDatabase } from "../encryptedDatabase";
import { readSecret } from "../../lib/helpers/secureStorage";

describe("SQLCipher migration", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const key = "a".repeat(64);
  const target = `/tmp/odin/odin-${userId}.db`;
  const statements: string[] = [];
  const { resetFiles } = jest.requireMock<{ resetFiles: (paths: string[]) => void }>("expo-file-system");
  const { openDatabaseAsync } = jest.requireMock<{ openDatabaseAsync: jest.Mock }>("expo-sqlite");

  beforeEach(() => {
    jest.clearAllMocks();
    statements.length = 0;
    resetFiles(["/tmp/odin/odin.db"]);
    jest.mocked(readSecret).mockResolvedValue(null);
  });

  function database() {
    return { closeAsync: jest.fn(async () => {}),
      execAsync: jest.fn(async (sql: string) => { statements.push(sql); }),
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql === "PRAGMA cipher_version") return { cipher_version: "4.6" };
        if (sql === "PRAGMA integrity_check") return { integrity_check: "ok" };
        return {};
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes("COUNT(*)")) return [{ name: "sync_queue", count: 12 }, { name: "transactions", count: 42 }];
        if (sql.includes("type = 'table'")) return [{ name: "sync_queue" }, { name: "transactions" }];
        return [];
      }),
    };
  }

  it("copies and verifies all tables and pending operations before replacing the legacy file", async () => {
    const source = database();
    const opened = database();
    openDatabaseAsync.mockImplementation(async (name: string) => {
      return name === "odin.db" ? source : opened;
    });
    await openEncryptedDatabase(userId, key);
    expect(source.getFirstAsync).toHaveBeenCalledWith("SELECT sqlcipher_export('encrypted')");
    expect(statements.find((sql) => sql.includes("ATTACH DATABASE"))).toContain("AS encrypted KEY");
    expect(source.getAllAsync).toHaveBeenCalledWith(expect.stringContaining("FROM encrypted.\"sync_queue\""));
    expect(new File(`file://${target}`).exists).toBe(true);
    expect(new File("file:///tmp/odin/odin.db").exists).toBe(false);
    expect(new File("file:///tmp/odin/odin-legacy-encrypted-v1.db").exists).toBe(true);
  });

  it("preserves old queued data for another account's first enrollment", async () => {
    resetFiles(["/tmp/odin/odin-legacy-encrypted-v1.db"]);
    const opened = database();
    openDatabaseAsync.mockResolvedValue(opened);
    await openEncryptedDatabase("22222222-2222-4222-8222-222222222222", "b".repeat(64));
    expect(openDatabaseAsync).toHaveBeenCalledWith("odin-legacy-encrypted-v1.db");
    expect(opened.getFirstAsync).toHaveBeenCalledWith("SELECT sqlcipher_export('encrypted')");
  });

  it("leaves the plaintext source intact when export fails", async () => {
    const opened = database();
    const source = database();
    source.getFirstAsync.mockRejectedValueOnce(new Error("Interrupted export"));
    openDatabaseAsync.mockImplementation(async (name: string) => name === "odin.db" ? source : opened);
    await expect(openEncryptedDatabase(userId, key)).rejects.toThrow();
    expect(new File("file:///tmp/odin/odin.db").exists).toBe(true);
    expect(new File(`file://${target}`).exists).toBe(false);
  });

  it("refuses to migrate when the native binary lacks SQLCipher", async () => {
    const opened = database();
    opened.getFirstAsync.mockResolvedValueOnce({});
    openDatabaseAsync.mockResolvedValue(opened);
    await expect(openEncryptedDatabase(userId, key)).rejects.toThrow("native build");
    expect(new File("file:///tmp/odin/odin.db").exists).toBe(true);
  });

  it("resumes plaintext cleanup only after the active encrypted file reopens", async () => {
    resetFiles([target, "/tmp/odin/odin.db", "/tmp/odin/odin.db-wal"]);
    openDatabaseAsync.mockResolvedValue(database());
    jest.mocked(readSecret).mockResolvedValue("verified");
    await openEncryptedDatabase(userId, key);
    expect(new File("file:///tmp/odin/odin.db").exists).toBe(false);
    expect(new File("file:///tmp/odin/odin.db-wal").exists).toBe(false);
  });

  it("preserves an existing file URI instead of prefixing it twice", async () => {
    const replacement = jest.replaceProperty(SQLite, "defaultDatabaseDirectory", "file:///tmp/odin");
    resetFiles([target]);
    openDatabaseAsync.mockResolvedValue(database());
    try {
      await expect(openEncryptedDatabase(userId, key)).resolves.toBeDefined();
      expect(openDatabaseAsync).toHaveBeenCalledWith(`odin-${userId}.db`);
    } finally { replacement.restore(); }
  });

  it("fails safely when the database directory is missing", async () => {
    const replacement = jest.replaceProperty(SQLite, "defaultDatabaseDirectory", null);
    try {
      await expect(openEncryptedDatabase(userId, key)).rejects.toThrow("location is unavailable");
      expect(openDatabaseAsync).not.toHaveBeenCalled();
    } finally { replacement.restore(); }
  });
});

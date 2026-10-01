import { jest } from "@jest/globals";

const mockGetAllAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetFirstAsync = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
  type: { "": null },
}));
jest.mock("../../client", () => ({
  initDatabase: jest.fn(),
}));

import { listCategories, listCategoryGroups, listSubcategories } from "../taxonomy";

beforeEach(() => {
  mockGetAllAsync.mockReset().mockResolvedValue([]);
  mockGetFirstAsync.mockReset().mockResolvedValue(null);

  // resetMocks clears implementations; re-set initDatabase before each test
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initDatabase } = require("../../client");
  initDatabase.mockResolvedValue({ getAllAsync: mockGetAllAsync, getFirstAsync: mockGetFirstAsync });
});

it("limits taxonomy to the active account", async () => {
  await listCategoryGroups("account-y");
  await listCategories("account-y");
  await listSubcategories("account-y");

  expect(mockGetAllAsync.mock.calls[0]![0]).not.toContain("user_id = ?");
  expect(mockGetAllAsync.mock.calls[1]![0]).toContain("user_id = ?");
  expect(mockGetAllAsync.mock.calls[1]![0]).not.toContain("is_system = 1");
  expect(mockGetAllAsync.mock.calls[2]![0]).toContain("user_id = ?");
  expect(mockGetAllAsync.mock.calls[2]![0]).not.toContain("is_system = 1");
});

it("retries a taxonomy read when SQLite is temporarily locked", async () => {
  mockGetAllAsync
    .mockRejectedValueOnce(new Error("database is locked"))
    .mockResolvedValueOnce([]);

  await expect(listCategories("account-y")).resolves.toEqual([]);

  expect(mockGetAllAsync).toHaveBeenCalledTimes(2);
});

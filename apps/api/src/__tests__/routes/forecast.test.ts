import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const mockClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  return {
    supabase: mockClient,
    createAuthenticatedSupabaseClient: () => mockClient,
  };
});

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { authHeader, validUserId } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

function mockAuth() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: validUserId } },
    error: null,
  });
}

type Call = { method: string; args: unknown[] };

function queryChain(result: { data: unknown; error: unknown }, methods: string[]): {
  chain: jest.Mock;
  calls: Call[];
} {
  const calls: Call[] = [];
  let node: unknown = result;
  for (let index = methods.length - 1; index >= 0; index--) {
    const method = methods[index];
    const previous = node;
    const fn = jest.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return previous;
    });
    node = { [method]: fn };
  }
  return { chain: node as jest.Mock, calls };
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthInWindow(offset: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return ymd(date);
}

const ACCOUNT_METHODS = ["select", "eq", "eq", "eq", "is"];
const TRANSACTION_METHODS = ["select", "eq", "eq", "is", "in", "gte", "order"];

function mockQueries(accounts: unknown, transactions: unknown) {
  const accountsChain = queryChain({ data: accounts, error: null }, ACCOUNT_METHODS);
  const transactionsChain = queryChain({ data: transactions, error: null }, TRANSACTION_METHODS);
  mockFrom.mockImplementation((table: string) => {
    if (table === "financial_accounts") return accountsChain.chain;
    return transactionsChain.chain;
  });
  return { accountsChain, transactionsChain };
}

describe("GET /odin/api/forecast", () => {
  it("returns a forecast payload built from the user's transactions", async () => {
    mockAuth();
    const { transactionsChain } = mockQueries(
      [{ current_balance_centavos: 1_000_000 }],
      [
        { transaction_type: "income", amount_centavos: 2_000_000, transaction_date: monthInWindow(-1), subcategories: { label: "Salary" } },
        { transaction_type: "expense", amount_centavos: 600_000, transaction_date: monthInWindow(-1), subcategories: { label: "Food" } },
      ],
    );

    const response = await request(app).get("/odin/api/forecast").set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.projected_balance_centavos).toBe(1_000_000 + 666_667 - 200_000);
    expect(response.body.payload.confidence).toBe("Fallback estimate");
    expect(response.body.payload.categories).toEqual([{ label: "Food", amount_centavos: 200_000 }]);

    const scoped = transactionsChain.calls
      .filter((call) => call.method === "eq")
      .map((call) => call.args);
    expect(scoped).toContainEqual(["user_id", validUserId]);
    expect(scoped).toContainEqual(["status", "posted"]);
  });

  it("returns an empty-data payload when the user has no transactions", async () => {
    mockAuth();
    mockQueries([{ current_balance_centavos: 500_000 }], []);

    const response = await request(app).get("/odin/api/forecast").set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.projected_balance_centavos).toBeNull();
    expect(response.body.payload.text).toBeNull();
    expect(response.body.payload.insights).toEqual([]);
  });

  it("returns 401 without authorization", async () => {
    const response = await request(app).get("/odin/api/forecast");
    expect(response.status).toBe(401);
  });

  it("returns 500 when the transaction read fails", async () => {
    mockAuth();
    const accountsChain = queryChain(
      { data: [{ current_balance_centavos: 1_000_000 }], error: null },
      ACCOUNT_METHODS,
    );
    const transactionsChain = queryChain(
      { data: null, error: { message: "Database error" } },
      TRANSACTION_METHODS,
    );
    mockFrom.mockImplementation((table: string) => (table === "financial_accounts" ? accountsChain.chain : transactionsChain.chain));

    const response = await request(app).get("/odin/api/forecast").set(authHeader());
    expect(response.status).toBe(500);
  });

  it("returns 401 with an invalid token", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await request(app)
      .get("/odin/api/forecast")
      .set(authHeader("bad-token"));

    expect(response.status).toBe(401);
  });
});
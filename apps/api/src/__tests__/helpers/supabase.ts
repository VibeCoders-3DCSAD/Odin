import { jest } from "@jest/globals";

export type MockQueryResult<T = unknown> = {
  data: T | null;
  error: { message: string; status?: number; code?: string } | null;
};

const CHAIN_METHODS = [
  "select", "insert", "update", "upsert", "delete",
  "eq", "neq", "gt", "gte", "lt", "lte",
  "order", "limit", "range", "is", "in", "not",
  "filter", "match", "csv", "abortSignal", "throwOnError",
] as const;

export function createMockQuery<T = unknown>(result: MockQueryResult<T>) {
  const handler: Record<string, jest.Mock> = {};

  for (const method of CHAIN_METHODS) {
    handler[method] = jest.fn(() => handler);
  }

  handler.single = jest.fn(() => result);
  handler.maybeSingle = jest.fn(() => result);

  return handler;
}

export function createMockSupabase() {
  const mockFrom = jest.fn();

  const mockClient = {
    from: mockFrom,
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
      setSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  };

  return { mockClient, mockFrom };
}

export type MockSupabase = ReturnType<typeof createMockSupabase>;

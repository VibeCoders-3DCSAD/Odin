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
import { createListQuery } from "../helpers/supabase.js";
import type { MockQueryResult } from "../helpers/supabase.js";
import { validUserId, authHeader } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

function mockAuth() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: validUserId } },
    error: null,
  });
}

describe("GET /odin/api/categories", () => {
  it("returns 200 with accessible categories", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "c1", slug: "essentials_food", label: "Food", user_id: null, is_active: true, sort_order: 100 },
        { id: "c2", slug: "my_custom", label: "My Custom", user_id: validUserId, is_active: true, sort_order: 500 },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/categories")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.categories).toHaveLength(2);
  });

  it("returns 200 with only user categories when include_system=false", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "c2", slug: "my_custom", label: "My Custom", user_id: validUserId, is_active: true, sort_order: 500 },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/categories?include_system=false")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.categories).toHaveLength(1);
    expect(response.body.payload.categories[0]).toMatchObject({
      user_id: validUserId,
    });
  });

  it("returns 200 with inactive categories when is_active=false", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "c3", slug: "archived", label: "Archived", user_id: validUserId, is_active: false, sort_order: 900 },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/categories?is_active=false")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.categories).toHaveLength(1);
    expect(response.body.payload.categories[0].is_active).toBe(false);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get("/odin/api/categories");
    expect(response.status).toBe(401);
  });

  it("returns 500 when database query fails", async () => {
    mockAuth();
    mockFrom.mockReturnValue(createListQuery({
      data: null,
      error: { message: "Database error" },
    }));

    const response = await request(app)
      .get("/odin/api/categories")
      .set(authHeader());

    expect(response.status).toBe(500);
  });
});

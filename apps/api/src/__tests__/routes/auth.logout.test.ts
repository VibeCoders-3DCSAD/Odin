import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
    },
  },
}));

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";

const mockSignOut = supabase.auth.signOut as jest.Mock;

describe("POST /odin/api/auth/logout", () => {
  it("returns 200 with logged_out:true when signOut succeeds", async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const response = await request(app)
      .post("/odin/api/auth/logout")
      .send({ payload: { reason: "user_requested" } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ payload: { logged_out: true } });
  });

  it("returns 200 even without a reason", async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const response = await request(app)
      .post("/odin/api/auth/logout")
      .send({ payload: {} });

    expect(response.status).toBe(200);
  });

  it("returns 500 when Supabase signOut fails", async () => {
    mockSignOut.mockResolvedValue({
      error: { message: "Session not found" },
    });

    const response = await request(app)
      .post("/odin/api/auth/logout")
      .send({ payload: { reason: "user_requested" } });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: "Internal Server Error" });
  });

  it("returns 500 when signOut throws", async () => {
    mockSignOut.mockRejectedValue(new Error("Supabase unreachable"));

    const response = await request(app)
      .post("/odin/api/auth/logout")
      .send({ payload: { reason: "user_requested" } });

    expect(response.status).toBe(500);
  });
});

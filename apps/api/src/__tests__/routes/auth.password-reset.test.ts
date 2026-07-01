import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { validPasswordResetPayload } from "../helpers/fixtures.js";

const mockResetPassword = supabase.auth.resetPasswordForEmail as jest.Mock;

describe("POST /odin/api/auth/password-reset", () => {
  it("returns 200 with requested:true when email is valid", async () => {
    mockResetPassword.mockResolvedValue({ data: {}, error: null });

    const response = await request(app)
      .post("/odin/api/auth/password-reset")
      .send(validPasswordResetPayload());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ payload: { requested: true } });
  });

  it("returns 200 even when email does not exist (reveal nothing)", async () => {
    mockResetPassword.mockResolvedValue({ data: {}, error: null });

    const response = await request(app)
      .post("/odin/api/auth/password-reset")
      .send({ payload: { email: "nonexistent@example.com" } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ payload: { requested: true } });
  });

  it("returns 400 when email is missing", async () => {
    const response = await request(app)
      .post("/odin/api/auth/password-reset")
      .send({ payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/email/i),
    });
  });

  it("returns 400 when payload wrapper is missing", async () => {
    const response = await request(app)
      .post("/odin/api/auth/password-reset")
      .send({});

    expect(response.status).toBe(400);
  });

  it("returns 400 when email is empty", async () => {
    const response = await request(app)
      .post("/odin/api/auth/password-reset")
      .send({ payload: { email: "" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when email is not a string", async () => {
    const response = await request(app)
      .post("/odin/api/auth/password-reset")
      .send({ payload: { email: null } });

    expect(response.status).toBe(400);
  });

  it("returns 429 when Supabase rate-limits", async () => {
    mockResetPassword.mockResolvedValue({
      data: {},
      error: { message: "Rate limit exceeded", status: 429 },
    });

    const response = await request(app)
      .post("/odin/api/auth/password-reset")
      .send(validPasswordResetPayload());

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({ error: "Too Many Requests" });
  });

  it("returns 500 when Supabase returns an unexpected error", async () => {
    mockResetPassword.mockResolvedValue({
      data: {},
      error: { message: "Internal error", status: 500 },
    });

    const response = await request(app)
      .post("/odin/api/auth/password-reset")
      .send(validPasswordResetPayload());

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: "Internal Server Error" });
  });

  it("returns 500 when resetPasswordForEmail throws", async () => {
    mockResetPassword.mockRejectedValue(new Error("Network error"));

    const response = await request(app)
      .post("/odin/api/auth/password-reset")
      .send(validPasswordResetPayload());

    expect(response.status).toBe(500);
  });
});

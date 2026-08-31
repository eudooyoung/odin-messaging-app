import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import type { RegisterResponseBody } from "@/types/api.types.js";

const getBody = <T>(res: Response) => res.body as T;

describe("POST /auth/register", () => {
  it("creates a user and returns the public user fields", async () => {
    const registration = {
      username: "new-user",
      password: "secure-password",
      displayName: "New User",
    };

    const res = await request(createApp()).post("/auth/register").send(registration);

    expect(res.status).toBe(201);

    const body = getBody<RegisterResponseBody>(res);
    expect(body.id).toBeTypeOf("number");
    expect(body).toEqual(
      expect.objectContaining({
        username: registration.username,
        displayName: registration.displayName,
      }),
    );
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("returns 400 when the password is shorter than 12 characters", async () => {
    const registration = {
      username: "new-user",
      password: "short",
      displayName: "New User",
    };

    const res = await request(createApp()).post("/auth/register").send(registration);

    expect(res.status).toBe(400);
  });

  it("returns 400 when the password is longer than 128 characters", async () => {
    const registration = {
      username: "new-user",
      password: "a".repeat(129),
      displayName: "New User",
    };

    const res = await request(createApp()).post("/auth/register").send(registration);

    expect(res.status).toBe(400);
  });

  it("returns 400 when the username contains only whitespace", async () => {
    const registration = {
      username: "   ",
      password: "secure-password",
      displayName: "New User",
    };

    const res = await request(createApp()).post("/auth/register").send(registration);

    expect(res.status).toBe(400);
  });

  it("returns 400 when the username is longer than 30 characters", async () => {
    const registration = {
      username: "a".repeat(31),
      password: "secure-password",
      displayName: "New User",
    };

    const res = await request(createApp()).post("/auth/register").send(registration);

    expect(res.status).toBe(400);
  });

  it("returns 400 when the display name contains only whitespace", async () => {
    const registration = {
      username: "new-user",
      password: "secure-password",
      displayName: "   ",
    };

    const res = await request(createApp()).post("/auth/register").send(registration);

    expect(res.status).toBe(400);
  });

  it("returns 400 when the display name is longer than 50 characters", async () => {
    const registration = {
      username: "new-user",
      password: "secure-password",
      displayName: "a".repeat(51),
    };

    const res = await request(createApp()).post("/auth/register").send(registration);

    expect(res.status).toBe(400);
  });

  it("returns 409 when the username already exists", async () => {
    const app = createApp();
    const registration = {
      username: "existing-user",
      password: "secure-password",
      displayName: "Existing User",
    };

    const firstResponse = await request(app).post("/auth/register").send(registration);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app).post("/auth/register").send({
      username: registration.username,
      password: "another-secure-password",
      displayName: "Another User",
    });

    expect(secondResponse.status).toBe(409);
  });
});

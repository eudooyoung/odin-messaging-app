import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import "@/tests/integration.setup.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import type { RegisterResponseBody } from "@/types/api.types.js";

const getBody = <T>(res: Response) => res.body as T;

describe("POST /auth/register", () => {
  it("generates and persists an initial handle, then returns the public user fields", async () => {
    const registration = {
      username: "new-user",
      password: "secure-password",
      displayName: "New User",
    };

    const res = await request(createApp()).post("/auth/register").send(registration);

    expect(res.status).toBe(201);

    const body = getBody<RegisterResponseBody>(res);
    expect(body.id).toBeTypeOf("number");
    const initialHandleMatcher: unknown = expect.stringMatching(/^user_[a-z0-9]{8}$/);
    expect(body).toEqual({
      id: body.id,
      username: registration.username,
      handle: initialHandleMatcher,
      displayName: registration.displayName,
    });

    const persistedUser = await prisma.user.findUnique({
      where: { id: body.id },
      select: {
        id: true,
        username: true,
        handle: true,
        displayName: true,
      },
    });

    expect(body).toEqual(persistedUser);
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
    const registration = {
      username: "existing-user",
      password: "secure-password",
      displayName: "Existing User",
    };

    await createTestUser({ username: registration.username });

    const response = await request(createApp()).post("/auth/register").send(registration);

    expect(response.status).toBe(409);
  });
});

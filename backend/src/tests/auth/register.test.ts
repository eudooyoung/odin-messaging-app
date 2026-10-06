import request from "supertest";
import { env } from "@/config/env.config.js";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import "@/tests/integration.setup.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import { getBody } from "@/tests/helpers/getBody.js";
import type { RegisterResponseBody } from "@/types/api.types.js";

describe("POST /auth/register", () => {
  it("generates and persists an initial handle, then returns the public user fields", async () => {
    const registration = {
      username: "new-user",
      password: "secure-password",
      displayName: "New User",
    };

    const res = await request(createApp())
      .post("/auth/register")
      .set("Origin", env.frontendOrigin)
      .send(registration);

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

  it.each([
    {
      caseName: "the password is shorter than 12 characters",
      registration: {
        username: "new-user",
        password: "short",
        displayName: "New User",
      },
    },
    {
      caseName: "the password is longer than 128 characters",
      registration: {
        username: "new-user",
        password: "a".repeat(129),
        displayName: "New User",
      },
    },
    {
      caseName: "the username contains only whitespace",
      registration: {
        username: "   ",
        password: "secure-password",
        displayName: "New User",
      },
    },
    {
      caseName: "the username is longer than 30 characters",
      registration: {
        username: "a".repeat(31),
        password: "secure-password",
        displayName: "New User",
      },
    },
    {
      caseName: "the display name contains only whitespace",
      registration: {
        username: "new-user",
        password: "secure-password",
        displayName: "   ",
      },
    },
    {
      caseName: "the display name is longer than 50 characters",
      registration: {
        username: "new-user",
        password: "secure-password",
        displayName: "a".repeat(51),
      },
    },
  ])("returns 400 when $caseName", async ({ registration }) => {
    const res = await request(createApp())
      .post("/auth/register")
      .set("Origin", env.frontendOrigin)
      .send(registration);

    expect(res.status).toBe(400);
  });

  it("returns 409 when the username already exists", async () => {
    const registration = {
      username: "existing-user",
      password: "secure-password",
      displayName: "Existing User",
    };

    await createTestUser({ username: registration.username });

    const response = await request(createApp())
      .post("/auth/register")
      .set("Origin", env.frontendOrigin)
      .send(registration);

    expect(response.status).toBe(409);
  });
});

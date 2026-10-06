import request from "supertest";
import { env } from "@/config/env.config.js";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import "@/tests/integration.setup.js";
import { getSetCookie } from "@/tests/helpers/cookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";

describe("POST /auth/login", () => {
  it("sets access and refresh token cookies for valid credentials", async () => {
    const app = createApp();
    const credentials = {
      username: "existing-user",
      password: "secure-password",
    };

    await createTestUser(credentials);

    const loginResponse = await request(app)
      .post("/auth/login")
      .set("Origin", env.frontendOrigin)
      .send(credentials);

    expect(loginResponse.status).toBe(204);

    const cookies = loginResponse.get("Set-Cookie");
    expect(getSetCookie(cookies, "accessToken")).toMatch(/^accessToken=[^;]+/);
    expect(getSetCookie(cookies, "refreshToken")).toMatch(/^refreshToken=[^;]+/);
  });

  it("returns 401 without token cookies when the user does not exist", async () => {
    const response = await request(createApp())
      .post("/auth/login")
      .set("Origin", env.frontendOrigin)
      .send({
        username: "missing-user",
        password: "secure-password",
      });

    expect(response.status).toBe(401);

    const cookies = response.get("Set-Cookie") ?? [];
    expect(cookies.some((cookie) => /^accessToken=/.test(cookie))).toBe(false);
    expect(cookies.some((cookie) => /^refreshToken=/.test(cookie))).toBe(false);
  });

  it("returns 401 without token cookies when the password does not match", async () => {
    const app = createApp();
    const username = "existing-user";

    await createTestUser({
      username,
      password: "secure-password",
      displayName: "Existing User",
    });

    const loginResponse = await request(app)
      .post("/auth/login")
      .set("Origin", env.frontendOrigin)
      .send({
        username,
        password: "wrong-password",
      });

    expect(loginResponse.status).toBe(401);

    const cookies = loginResponse.get("Set-Cookie") ?? [];
    expect(cookies.some((cookie) => /^accessToken=/.test(cookie))).toBe(false);
    expect(cookies.some((cookie) => /^refreshToken=/.test(cookie))).toBe(false);
  });

  it.each([
    {
      caseName: "the username is blank",
      username: "   ",
      password: "secure-password",
    },
    {
      caseName: "the username is longer than 30 characters",
      username: "a".repeat(31),
      password: "secure-password",
    },
    {
      caseName: "the password is shorter than 12 characters",
      username: "new-user",
      password: "a".repeat(11),
    },
    {
      caseName: "the password is longer than 128 characters",
      username: "new-user",
      password: "a".repeat(129),
    },
  ])("returns 400 without token cookies when $caseName", async ({ username, password }) => {
    const response = await request(createApp())
      .post("/auth/login")
      .set("Origin", env.frontendOrigin)
      .send({
        username,
        password,
      });

    expect(response.status).toBe(400);

    const cookies = response.get("Set-Cookie") ?? [];
    expect(cookies.some((cookie) => /^accessToken=/.test(cookie))).toBe(false);
    expect(cookies.some((cookie) => /^refreshToken=/.test(cookie))).toBe(false);
  });
});

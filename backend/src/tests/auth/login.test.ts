import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";

describe("POST /auth/login", () => {
  it("sets access and refresh token cookies for valid credentials", async () => {
    const app = createApp();
    const credentials = {
      username: "existing-user",
      password: "secure-password",
    };

    const registerResponse = await request(app)
      .post("/auth/register")
      .send({
        ...credentials,
        displayName: "Existing User",
      });

    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app).post("/auth/login").send(credentials);

    expect(loginResponse.status).toBe(204);

    const cookies = loginResponse.get("Set-Cookie") ?? [];
    expect(cookies.some((cookie) => /^accessToken=[^;]+/.test(cookie))).toBe(true);
    expect(cookies.some((cookie) => /^refreshToken=[^;]+/.test(cookie))).toBe(true);
  });

  it("returns 401 without token cookies when the user does not exist", async () => {
    const response = await request(createApp()).post("/auth/login").send({
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

    const registerResponse = await request(app).post("/auth/register").send({
      username,
      password: "secure-password",
      displayName: "Existing User",
    });

    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app).post("/auth/login").send({
      username,
      password: "wrong-password",
    });

    expect(loginResponse.status).toBe(401);

    const cookies = loginResponse.get("Set-Cookie") ?? [];
    expect(cookies.some((cookie) => /^accessToken=/.test(cookie))).toBe(false);
    expect(cookies.some((cookie) => /^refreshToken=/.test(cookie))).toBe(false);
  });

  it("returns 400 without token cookies when the username is blank", async () => {
    const response = await request(createApp()).post("/auth/login").send({
      username: "   ",
      password: "secure-password",
    });

    expect(response.status).toBe(400);

    const cookies = response.get("Set-Cookie") ?? [];
    expect(cookies.some((cookie) => /^accessToken=/.test(cookie))).toBe(false);
    expect(cookies.some((cookie) => /^refreshToken=/.test(cookie))).toBe(false);
  });

  it.each([
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
    const response = await request(createApp()).post("/auth/login").send({
      username,
      password,
    });

    expect(response.status).toBe(400);

    const cookies = response.get("Set-Cookie") ?? [];
    expect(cookies.some((cookie) => /^accessToken=/.test(cookie))).toBe(false);
    expect(cookies.some((cookie) => /^refreshToken=/.test(cookie))).toBe(false);
  });
});

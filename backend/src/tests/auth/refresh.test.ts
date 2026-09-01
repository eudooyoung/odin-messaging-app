import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app.js";
import { env } from "@/config/env.config.js";
import { prisma } from "@/lib/prisma.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";

const getCookie = (cookies: string[] | undefined, name: string) => {
  const cookie = cookies?.find((candidate) => candidate.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`${name} cookie was not set`);
  }

  const separatorIndex = cookie.indexOf(";");

  return separatorIndex === -1 ? cookie : cookie.slice(0, separatorIndex);
};

const getCookieValue = (cookie: string) => cookie.slice(cookie.indexOf("=") + 1);

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const loginTestUser = async () => {
  const credentials = {
    username: "existing-user",
    password: "secure-password",
  };
  const user = await createTestUser(credentials);
  const response = await request(createApp()).post("/auth/login").send(credentials);

  return {
    user,
    refreshCookie: getCookie(response.get("Set-Cookie"), "refreshToken"),
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /auth/refresh", () => {
  it("rotates the refresh session in a transaction and resets both token cookies", async () => {
    const app = createApp();
    const { user, refreshCookie } = await loginTestUser();
    const oldRefreshToken = getCookieValue(refreshCookie);
    const oldTokenHash = hashToken(oldRefreshToken);
    const transactionSpy = vi.spyOn(prisma, "$transaction");

    const response = await request(app).post("/auth/refresh").set("Cookie", refreshCookie);

    expect(response.status).toBe(204);
    expect(transactionSpy).toHaveBeenCalledOnce();

    const cookies = response.get("Set-Cookie");
    const newAccessCookie = getCookie(cookies, "accessToken");
    const newRefreshCookie = getCookie(cookies, "refreshToken");
    const newRefreshToken = getCookieValue(newRefreshCookie);

    expect(newAccessCookie).toMatch(/^accessToken=[^;]+/);
    expect(newRefreshCookie).toMatch(/^refreshToken=[^;]+/);
    expect(newRefreshToken).not.toBe(oldRefreshToken);
    await expect(
      prisma.refreshSession.findUnique({ where: { tokenHash: oldTokenHash } }),
    ).resolves.toBeNull();
    await expect(
      prisma.refreshSession.findUnique({ where: { tokenHash: hashToken(newRefreshToken) } }),
    ).resolves.toMatchObject({ userId: user.id });
    await expect(
      prisma.refreshSession.count({ where: { userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("returns 401 when the refresh cookie is missing", async () => {
    const response = await request(createApp()).post("/auth/refresh");

    expect(response.status).toBe(401);
  });

  it("returns 401 when the refresh token is invalid", async () => {
    const invalidToken = "invalid-refresh-token";
    const user = await createTestUser();

    await prisma.refreshSession.create({
      data: {
        tokenHash: hashToken(invalidToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(createApp())
      .post("/auth/refresh")
      .set("Cookie", `refreshToken=${invalidToken}`);

    expect(response.status).toBe(401);
  });

  it("returns 401 when the refresh token JWT is expired", async () => {
    const user = await createTestUser();
    const expiredToken = jwt.sign(
      { sub: String(user.id), tokenType: "refresh" },
      env.jwtSecret,
      { expiresIn: -1 },
    );

    await prisma.refreshSession.create({
      data: {
        tokenHash: hashToken(expiredToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(createApp())
      .post("/auth/refresh")
      .set("Cookie", `refreshToken=${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it("returns 401 when no refresh session matches the token hash", async () => {
    const user = await createTestUser();
    const refreshToken = jwt.sign(
      { sub: String(user.id), tokenType: "refresh" },
      env.jwtSecret,
      { expiresIn: "7d" },
    );

    const response = await request(createApp())
      .post("/auth/refresh")
      .set("Cookie", `refreshToken=${refreshToken}`);

    expect(response.status).toBe(401);
  });

  it("returns 401 when the refresh session in the database is expired", async () => {
    const user = await createTestUser();
    const refreshToken = jwt.sign(
      { sub: String(user.id), tokenType: "refresh" },
      env.jwtSecret,
      { expiresIn: "7d" },
    );

    await prisma.refreshSession.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() - 1),
      },
    });

    const response = await request(createApp())
      .post("/auth/refresh")
      .set("Cookie", `refreshToken=${refreshToken}`);

    expect(response.status).toBe(401);
  });

  it("returns 401 when a previously rotated refresh token is reused", async () => {
    const app = createApp();
    const { refreshCookie } = await loginTestUser();

    const rotationResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", refreshCookie);
    const reuseResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", refreshCookie);

    expect(rotationResponse.status).toBe(204);
    expect(reuseResponse.status).toBe(401);
  });
});

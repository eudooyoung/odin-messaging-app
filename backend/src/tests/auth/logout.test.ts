import { createHash } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import {
  getCookiePair,
  getCookieValue,
  getSetCookie,
} from "@/tests/helpers/cookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";

const expectAuthCookiesCleared = (cookies: string[] | undefined) => {
  const clearedAccessCookie = getSetCookie(cookies, "accessToken");
  const clearedRefreshCookie = getSetCookie(cookies, "refreshToken");

  expect(clearedAccessCookie).toMatch(/^accessToken=;/);
  expect(clearedAccessCookie).toContain("Path=/");
  expect(clearedAccessCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  expect(clearedRefreshCookie).toMatch(/^refreshToken=;/);
  expect(clearedRefreshCookie).toContain("Path=/auth");
  expect(clearedRefreshCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
};

describe("POST /auth/logout", () => {
  it("deletes the refresh session, clears both token cookies, and returns 204", async () => {
    const app = createApp();
    const credentials = {
      username: "existing-user",
      password: "secure-password",
    };

    await createTestUser(credentials);

    const loginResponse = await request(app).post("/auth/login").send(credentials);
    const refreshCookie = getSetCookie(loginResponse.get("Set-Cookie"), "refreshToken");
    const refreshCookiePair = getCookiePair(refreshCookie);
    const refreshToken = getCookieValue(refreshCookiePair);
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");

    await expect(
      prisma.refreshSession.findUnique({ where: { tokenHash } }),
    ).resolves.not.toBeNull();

    const response = await request(app).post("/auth/logout").set("Cookie", refreshCookiePair);

    expect(response.status).toBe(204);
    await expect(prisma.refreshSession.findUnique({ where: { tokenHash } })).resolves.toBeNull();

    expectAuthCookiesCleared(response.get("Set-Cookie"));
  });

  it.each([
    {
      caseName: "the refresh cookie is missing",
      refreshCookie: undefined,
    },
    {
      caseName: "the refresh session does not exist",
      refreshCookie: "refreshToken=refresh-token-without-session",
    },
  ])("returns 204 and clears both token cookies when $caseName", async ({ refreshCookie }) => {
    let logoutRequest = request(createApp()).post("/auth/logout");

    if (refreshCookie) {
      logoutRequest = logoutRequest.set("Cookie", refreshCookie);
    }

    const response = await logoutRequest;

    expect(response.status).toBe(204);
    expectAuthCookiesCleared(response.get("Set-Cookie"));
  });
});

import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { getCookiePair, getSetCookie } from "@/tests/helpers/cookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";

type MeResponseBody = {
  id: number;
  username: string;
  displayName: string;
};

const getBody = <T>(response: Response) => response.body as T;

describe("GET /auth/me", () => {
  it("returns the logged-in user's public fields for a valid access token cookie", async () => {
    const app = createApp();
    const credentials = {
      username: "existing-user",
      password: "secure-password",
      displayName: "Existing User",
    };
    const user = await createTestUser(credentials);
    const loginResponse = await request(app).post("/auth/login").send(credentials);
    const accessCookie = getCookiePair(
      getSetCookie(loginResponse.get("Set-Cookie"), "accessToken"),
    );

    const response = await request(app).get("/auth/me").set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<MeResponseBody>(response);
    expect(body).toEqual({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    });
    expect(body).not.toHaveProperty("passwordHash");
  });

  it.each([
    {
      caseName: "the access token cookie is missing",
      accessCookie: undefined,
    },
    {
      caseName: "the access token is invalid",
      accessCookie: "accessToken=invalid-access-token",
    },
  ])("returns 401 when $caseName", async ({ accessCookie }) => {
    let meRequest = request(createApp()).get("/auth/me");

    if (accessCookie) {
      meRequest = meRequest.set("Cookie", accessCookie);
    }

    const response = await meRequest;

    expect(response.status).toBe(401);
  });
});

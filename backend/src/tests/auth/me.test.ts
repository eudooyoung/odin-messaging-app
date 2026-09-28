import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import { getBody } from "@/tests/helpers/getBody.js";
import type { MeResponseBody } from "@/types/api.types.js";
import "@/tests/integration.setup.js";

describe("GET /auth/me", () => {
  it("returns the logged-in user's account fields for a valid access token cookie", async () => {
    const app = createApp();
    const credentials = {
      username: "existing-user",
      password: "secure-password",
      handle: "existing_user_handle",
      displayName: "Existing User",
    };
    const user = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(user.id);

    const response = await request(app).get("/auth/me").set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<MeResponseBody>(response);
    expect(body).toEqual({
      id: user.id,
      username: user.username,
      handle: user.handle,
      displayName: user.displayName,
    });
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

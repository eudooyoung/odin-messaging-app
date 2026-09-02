import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";
import type { UserProfileResponseBody } from "@/types/api.types";

const getBody = <T>(response: Response) => response.body as T;

describe("GET /users/:username", () => {
  it("returns the user's public profile for an authenticated user", async () => {
    const app = createApp();
    const credentials = {
      username: "requesting-user",
      password: "secure-password",
      displayName: "Requesting User",
    };
    const targetUser = await createTestUser({
      username: "profile-user",
      displayName: "Profile User",
      bio: "Hello, I'm a profile user.",
      profileImage: "https://example.com/profile.jpg",
    });
    const requestingUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(requestingUser.id);

    const response = await request(app)
      .get(`/users/${targetUser.username}`)
      .set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<UserProfileResponseBody>(response);
    expect(body).toEqual({
      username: targetUser.username,
      displayName: targetUser.displayName,
      bio: targetUser.bio,
      profileImage: targetUser.profileImage,
    });
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp()).get("/users/profile-user");

    expect(response.status).toBe(401);
  });

  it("returns 404 when the user does not exist", async () => {
    const app = createApp();
    const credentials = {
      username: "requesting-user",
      password: "secure-password",
      displayName: "Requesting User",
    };
    const requestingUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(requestingUser.id);

    const response = await request(app)
      .get("/users/missing-user")
      .set("Cookie", accessCookie);

    expect(response.status).toBe(404);
  });
});

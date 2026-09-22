import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";
import type { GetUserProfileResponseBody } from "@/types/api.types";

const getBody = <T>(response: Response) => response.body as T;

describe("GET /users/:handle", () => {
  it("returns the user's public profile for an authenticated user", async () => {
    const app = createApp();
    const credentials = {
      username: "requesting-user",
      password: "secure-password",
      displayName: "Requesting User",
    };
    const targetUser = await createTestUser({
      username: "profile-user",
      handle: "profile-user-handle",
      displayName: "Profile User",
      bio: "Hello, I'm a profile user.",
      profileImage: "https://example.com/profile.jpg",
    });
    const requestingUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(requestingUser.id);

    const response = await request(app)
      .get(`/users/${targetUser.handle}`)
      .set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<GetUserProfileResponseBody>(response);
    expect(body).toEqual({
      id: targetUser.id,
      handle: targetUser.handle,
      displayName: targetUser.displayName,
      bio: targetUser.bio,
      profileImage: targetUser.profileImage,
    });
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp()).get("/users/profile-user-handle");

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

    const response = await request(app).get("/users/missing-handle").set("Cookie", accessCookie);

    expect(response.status).toBe(404);
  });
});

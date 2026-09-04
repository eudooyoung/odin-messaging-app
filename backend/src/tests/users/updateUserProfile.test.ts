import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";
import type { UpdateUserProfileInput, UserProfileResponseBody } from "@/types/api.types.js";

const getBody = <T>(response: Response) => response.body as T;

describe("PATCH /users/me", () => {
  it("updates and returns the authenticated user's profile", async () => {
    const app = createApp();
    const password = "secure-password";
    const user = await createTestUser({
      username: "existing-user",
      password,
      displayName: "Existing User",
      bio: "Existing bio",
      profileImage: "https://example.com/existing-profile.jpg",
    });
    const accessCookie = createAccessTokenCookie(user.id);
    const updateData = {
      displayName: "Updated User",
      bio: "Updated bio",
    } satisfies UpdateUserProfileInput;

    const response = await request(app)
      .patch("/users/me")
      .set("Cookie", accessCookie)
      .send(updateData);

    expect(response.status).toBe(200);

    const expectedProfile: UserProfileResponseBody = {
      username: user.username,
      displayName: updateData.displayName,
      bio: updateData.bio,
      profileImage: user.profileImage,
    };
    const body = getBody<UserProfileResponseBody>(response);
    expect(body).toEqual(expectedProfile);

    const persistedProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        username: true,
        displayName: true,
        bio: true,
        profileImage: true,
      },
    });
    expect(persistedProfile).toEqual(expectedProfile);
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp()).patch("/users/me").send({
      displayName: "Updated User",
    });

    expect(response.status).toBe(401);
  });

  it.each([
    {
      caseName: "the display name is blank after trimming",
      updateData: { displayName: "   " },
    },
    {
      caseName: "the display name is longer than 50 characters",
      updateData: { displayName: "a".repeat(51) },
    },
    {
      caseName: "the bio is longer than 300 characters",
      updateData: { bio: "a".repeat(301) },
    },
  ])("returns 400 when $caseName", async ({ updateData }) => {
    const app = createApp();
    const password = "secure-password";
    const user = await createTestUser({
      username: "existing-user",
      password,
    });
    const accessCookie = createAccessTokenCookie(user.id);

    const response = await request(app)
      .patch("/users/me")
      .set("Cookie", accessCookie)
      .send(updateData);

    expect(response.status).toBe(400);
  });
});

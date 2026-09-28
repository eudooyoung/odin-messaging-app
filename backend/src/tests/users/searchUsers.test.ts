import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import { getBody } from "@/tests/helpers/getBody.js";
import "@/tests/integration.setup.js";
import type { SearchUsersResponseBody } from "@/types/api.types.js";

describe("GET /users?query=", () => {
  it("returns users whose handle or display name contains the query", async () => {
    const app = createApp();
    const credentials = {
      username: "requesting-user",
      password: "secure-password",
      displayName: "Requesting User",
    };
    const handleMatch = await createTestUser({
      username: "handle-match-user",
      handle: "alex_handle",
      displayName: "First Match",
      profileImage: null,
    });
    const displayNameMatch = await createTestUser({
      username: "display-name-match",
      handle: "display_name_match_handle",
      displayName: "Alexandra Lee",
      profileImage: "https://example.com/alexandra.jpg",
    });
    await createTestUser({
      username: "alex-username-only",
      handle: "unrelated_handle",
      displayName: "Unrelated User",
    });
    const requestingUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(requestingUser.id);

    const response = await request(app)
      .get("/users")
      .query({ query: "alex" })
      .set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<SearchUsersResponseBody>(response);
    expect(body).toHaveLength(2);
    expect(body).toEqual(
      expect.arrayContaining([
        {
          handle: handleMatch.handle,
          displayName: handleMatch.displayName,
          profileImage: handleMatch.profileImage,
        },
        {
          handle: displayNameMatch.handle,
          displayName: displayNameMatch.displayName,
          profileImage: displayNameMatch.profileImage,
        },
      ]),
    );
  });

  it("excludes the requesting user when both users match the query", async () => {
    const app = createApp();
    const requestingUser = await createTestUser({
      username: "requesting-user",
      handle: "alex_self",
      displayName: "Requesting User",
    });
    const otherUser = await createTestUser({
      username: "other-user",
      handle: "other_handle",
      displayName: "Alex Other",
      profileImage: null,
    });
    const accessCookie = createAccessTokenCookie(requestingUser.id);

    const response = await request(app)
      .get("/users")
      .query({ query: "alex" })
      .set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<SearchUsersResponseBody>(response);
    expect(body).toEqual([
      {
        handle: otherUser.handle,
        displayName: otherUser.displayName,
        profileImage: otherUser.profileImage,
      },
    ]);
  });

  it("returns an empty array when no users match the query", async () => {
    const app = createApp();
    const credentials = {
      username: "requesting-user",
      password: "secure-password",
      displayName: "Requesting User",
    };
    const requestingUser = await createTestUser(credentials);
    await createTestUser({
      username: "unrelated-user",
      displayName: "Unrelated User",
    });
    const accessCookie = createAccessTokenCookie(requestingUser.id);

    const response = await request(app)
      .get("/users")
      .query({ query: "no-match" })
      .set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<SearchUsersResponseBody>(response);
    expect(body).toEqual([]);
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp()).get("/users").query({ query: "alex" });

    expect(response.status).toBe(401);
  });

  it.each([
    {
      caseName: "the query is missing",
      query: undefined,
    },
    {
      caseName: "the query is empty",
      query: "",
    },
    {
      caseName: "the query contains only whitespace",
      query: "   ",
    },
    {
      caseName: "the query is longer than 50 characters",
      query: "a".repeat(51),
    },
  ])("returns 400 when $caseName", async ({ query }) => {
    const app = createApp();
    const credentials = {
      username: "requesting-user",
      password: "secure-password",
      displayName: "Requesting User",
    };
    const requestingUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(requestingUser.id);
    let searchRequest = request(app).get("/users").set("Cookie", accessCookie);

    if (query !== undefined) {
      searchRequest = searchRequest.query({ query });
    }

    const response = await searchRequest;

    expect(response.status).toBe(400);
  });
});

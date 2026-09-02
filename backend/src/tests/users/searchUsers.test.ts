import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";
import type { SearchUsersResponseBody } from "@/types/api.types.js";

const getBody = <T>(response: Response) => response.body as T;

describe("GET /users?query=", () => {
  it("returns users whose username or display name contains the query", async () => {
    const app = createApp();
    const credentials = {
      username: "requesting-user",
      password: "secure-password",
      displayName: "Requesting User",
    };
    const usernameMatch = await createTestUser({
      username: "alex-user",
      displayName: "First Match",
      profileImage: null,
    });
    const displayNameMatch = await createTestUser({
      username: "display-name-match",
      displayName: "Alexandra Lee",
      profileImage: "https://example.com/alexandra.jpg",
    });
    await createTestUser({
      username: "unrelated-user",
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
          username: usernameMatch.username,
          displayName: usernameMatch.displayName,
          profileImage: usernameMatch.profileImage,
        },
        {
          username: displayNameMatch.username,
          displayName: displayNameMatch.displayName,
          profileImage: displayNameMatch.profileImage,
        },
      ]),
    );
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

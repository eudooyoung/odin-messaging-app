import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import {
  USER_PROFILE_QUERY_ERROR_MESSAGE,
  type UserProfile,
  userProfileQueryOptions,
} from "./userProfileQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

let queryClient: QueryClient;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const profileResponse = (profile: UserProfile) =>
  new Response(JSON.stringify(profile), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

describe("userProfileQueryOptions", () => {
  it("gets and returns the requested user's profile", async () => {
    const username = "profile-user";
    const profile = {
      username,
      displayName: "Profile User",
      bio: "Hello, I'm a profile user.",
      profileImage: "https://example.com/profile-user.jpg",
    };
    vi.mocked(apiFetch).mockResolvedValue(profileResponse(profile));
    const result = await queryClient.query(userProfileQueryOptions(username));

    expect(apiFetch).toHaveBeenCalledWith(`/users/${username}`, {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual(profile);
  });

  it("uses the requested username in the query key", () => {
    const firstUserQuery = userProfileQueryOptions("first-user");
    const secondUserQuery = userProfileQueryOptions("second-user");

    expect(firstUserQuery.queryKey).toEqual(["users", "profile", "first-user"]);
    expect(secondUserQuery.queryKey).toEqual(["users", "profile", "second-user"]);
  });

  it.each(["alice#1", "a/b", "name?x"])(
    "encodes the username %s when using it as a URL path segment",
    async (username) => {
      const profile = {
        username,
        displayName: "Profile User",
        bio: null,
        profileImage: null,
      };
      vi.mocked(apiFetch).mockResolvedValue(profileResponse(profile));
      await queryClient.query(userProfileQueryOptions(username));

      expect(apiFetch).toHaveBeenCalledWith(
        `/users/${encodeURIComponent(username)}`,
        { signal: expect.any(AbortSignal) },
      );
    },
  );

  describe("errors", () => {
    it("throws a user-facing error when the requested profile does not exist", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 404 }));
      const result = queryClient.query(userProfileQueryOptions("missing-user"));

      await expect(result).rejects.toBeInstanceOf(UserFacingError);
      await expect(result).rejects.toThrow("Profile not found");
    });

    it("throws a generic user-facing error for other unsuccessful responses", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
      const result = queryClient.query(userProfileQueryOptions("profile-user"));

      await expect(result).rejects.toBeInstanceOf(UserFacingError);
      await expect(result).rejects.toThrow(USER_PROFILE_QUERY_ERROR_MESSAGE);
    });

    it("preserves the original error when apiFetch rejects", async () => {
      const transportError = new TypeError("Failed to fetch");
      vi.mocked(apiFetch).mockRejectedValue(transportError);
      const result = queryClient.query(userProfileQueryOptions("profile-user"));

      await expect(result).rejects.toBe(transportError);
    });
  });
});

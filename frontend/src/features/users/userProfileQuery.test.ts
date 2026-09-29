import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import {
  USER_PROFILE_QUERY_ERROR_MESSAGE,
  UserProfileNotFoundError,
  userProfileQueryOptions,
  type UserProfile,
} from "./userProfileQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("userProfileQueryOptions", () => {
  let queryClient: QueryClient;

  const profileResponse = (profile: UserProfile) => jsonResponse(profile);

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("gets and returns the requested user's profile", async () => {
    const handle = "profile-user";
    const profile = {
      id: 2,
      handle,
      displayName: "Profile User",
      bio: "Hello, I'm a profile user.",
      profileImage: "https://example.com/profile-user.jpg",
    };
    vi.mocked(apiFetch).mockResolvedValue(profileResponse(profile));
    const result = await queryClient.query(userProfileQueryOptions(handle));

    expectTypeOf(result).toEqualTypeOf<UserProfile>();
    expect(apiFetch).toHaveBeenCalledWith(`/users/${handle}`, {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual(profile);
  });

  it("uses the requested handle in the query key", () => {
    const firstUserQuery = userProfileQueryOptions("first-user");
    const secondUserQuery = userProfileQueryOptions("second-user");

    expect(firstUserQuery.queryKey).toEqual(["users", "profile", "first-user"]);
    expect(secondUserQuery.queryKey).toEqual(["users", "profile", "second-user"]);
  });

  it.each(["alice#1", "a/b", "name?x"])(
    "encodes the handle %s when using it as a URL path segment",
    async (handle) => {
      const profile = {
        id: 2,
        handle,
        displayName: "Profile User",
        bio: null,
        profileImage: null,
      };
      vi.mocked(apiFetch).mockResolvedValue(profileResponse(profile));
      await queryClient.query(userProfileQueryOptions(handle));

      expect(apiFetch).toHaveBeenCalledWith(`/users/${encodeURIComponent(handle)}`, {
        signal: expect.any(AbortSignal),
      });
    },
  );

  describe("errors", () => {
    it("throws a profile-not-found error when the requested profile does not exist", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 404 }));
      const result = queryClient.query(userProfileQueryOptions("missing-user"));

      await expect(result).rejects.toBeInstanceOf(UserProfileNotFoundError);
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

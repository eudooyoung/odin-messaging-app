import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import type { UpdateUserProfileInput } from "./user.type.ts";
import { UPDATE_USER_PROFILE_ERROR_MESSAGE, updateUserProfile } from "./updateUserProfile.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("updateUserProfile", () => {
  it("updates and returns the current user's profile", async () => {
    const updateData = {
      handle: "updated-handle",
      displayName: "Updated User",
      bio: "Updated bio",
      profileImage: "https://example.com/updated-profile.jpg",
    } satisfies UpdateUserProfileInput;
    const updatedProfile = {
      username: "current-user",
      ...updateData,
    };
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(updatedProfile), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await updateUserProfile(updateData);

    expect(apiFetch).toHaveBeenCalledWith("/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
    expect(result).toEqual(updatedProfile);
  });

  describe("errors", () => {
    it.each([
      {
        caseName: "the handle is already taken",
        status: 409,
        input: { handle: "taken_handle" },
        expectedMessage: "This handle is already taken",
      },
      {
        caseName: "the profile input is invalid",
        status: 400,
        input: { displayName: "" },
        expectedMessage: "Invalid profile input",
      },
      {
        caseName: "the response is otherwise unsuccessful",
        status: 500,
        input: { displayName: "Updated User" },
        expectedMessage: UPDATE_USER_PROFILE_ERROR_MESSAGE,
      },
    ])(
      "throws the appropriate user-facing error when $caseName",
      async ({ status, input, expectedMessage }) => {
        vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status }));

        const result = updateUserProfile(input);

        await expect(result).rejects.toBeInstanceOf(UserFacingError);
        await expect(result).rejects.toThrow(expectedMessage);
      },
    );

    it("preserves the original error when apiFetch rejects", async () => {
      const transportError = new TypeError("Failed to fetch");
      vi.mocked(apiFetch).mockRejectedValue(transportError);

      const result = updateUserProfile({ displayName: "Updated User" });

      await expect(result).rejects.toBe(transportError);
    });
  });
});

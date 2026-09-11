import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import {
  UPDATE_USER_PROFILE_ERROR_MESSAGE,
  updateUserProfile,
} from "./updateUserProfile.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("updateUserProfile", () => {
  it("updates and returns the current user's profile", async () => {
    const updateData = {
      displayName: "Updated User",
      bio: "Updated bio",
      profileImage: "https://example.com/updated-profile.jpg",
    };
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

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
    expect(result).toEqual(updatedProfile);
  });

  it("throws a user-facing validation error when the profile input is invalid", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 400 }));

    const result = updateUserProfile({ displayName: "" });

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Invalid profile input");
  });

  it("throws a generic user-facing error for other unsuccessful responses", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    const result = updateUserProfile({ displayName: "Updated User" });

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow(UPDATE_USER_PROFILE_ERROR_MESSAGE);
  });

  it("preserves the original error when apiFetch rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);

    const result = updateUserProfile({ displayName: "Updated User" });

    await expect(result).rejects.toBe(transportError);
  });
});

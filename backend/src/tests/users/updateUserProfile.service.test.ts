import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UnauthorizedError from "@/errors/unauthorizedError.js";
import type { updateUserProfile } from "@/repositories/user.repository.js";
import { updateUserProfileService } from "@/services/user.service.js";

const { updateUserProfileMock } = vi.hoisted(() => ({
  updateUserProfileMock: vi.fn<typeof updateUserProfile>(),
}));

vi.mock("@/repositories/user.repository.js", () => ({
  findUserProfileByUsername: vi.fn(),
  updateUserProfile: updateUserProfileMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("updateUserProfileService", () => {
  it("updates and returns the user's public profile", async () => {
    const userId = 1;
    const updateData = {
      displayName: "Updated User",
      bio: "Updated bio",
      profileImage: "https://example.com/updated-profile.jpg",
    };
    const updatedProfile = {
      username: "existing-user",
      displayName: updateData.displayName,
      bio: updateData.bio,
      profileImage: updateData.profileImage,
    };

    updateUserProfileMock.mockResolvedValue(updatedProfile);

    const result = await updateUserProfileService(userId, updateData);

    expect(updateUserProfileMock).toHaveBeenCalledWith(userId, updateData);
    expect(result).toEqual(updatedProfile);
  });

  it("throws an authentication error when the user does not exist", async () => {
    const userId = 1;
    const updateData = {
      displayName: "Updated User",
    };
    const missingUserError = new PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "test",
    });

    updateUserProfileMock.mockRejectedValue(missingUserError);

    const result = updateUserProfileService(userId, updateData);

    expect(updateUserProfileMock).toHaveBeenCalledWith(userId, updateData);
    await expect(result).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(result).rejects.toMatchObject({ statusCode: 401 });
  });
});

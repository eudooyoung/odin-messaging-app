import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConflictError from "@/errors/conflictError.js";
import UnauthorizedError from "@/errors/unauthorizedError.js";
import type { updateUserProfile } from "@/repositories/user.repository.js";
import { updateUserProfileService } from "@/services/user.service.js";

const { updateUserProfileMock } = vi.hoisted(() => ({
  updateUserProfileMock: vi.fn<typeof updateUserProfile>(),
}));

vi.mock("@/repositories/user.repository.js", () => ({
  updateUserProfile: updateUserProfileMock,
}));

const uniqueConstraintIndexes = {
  handle: "User_handle_key",
  username: "User_username_key",
};

const createUniqueConstraintError = (index: string) =>
  new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: {
      modelName: "User",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          kind: "UniqueConstraintViolation",
          constraint: { index },
        },
      },
    },
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("updateUserProfileService", () => {
  it("updates and returns the user's public profile", async () => {
    const userId = 1;
    const updateData = {
      handle: "updated_handle",
      displayName: "Updated User",
      bio: "Updated bio",
      profileImage: "https://example.com/updated-profile.jpg",
    };
    const updatedProfile = {
      username: "existing-user",
      handle: updateData.handle,
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

  it("converts a duplicate handle error to ConflictError", async () => {
    const userId = 1;
    const updateData = { handle: "existing_handle" };
    const duplicateHandleError = createUniqueConstraintError(uniqueConstraintIndexes.handle);

    updateUserProfileMock.mockRejectedValue(duplicateHandleError);

    const result = updateUserProfileService(userId, updateData);

    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toMatchObject({
      statusCode: 409,
      code: "HANDLE_ALREADY_EXISTS",
    });
  });

  it.each([
    {
      caseName: "the username unique constraint fails",
      index: uniqueConstraintIndexes.username,
    },
    {
      caseName: "another unique constraint fails",
      index: "Other_unique_key",
    },
  ])("rethrows the original error when $caseName", async ({ index }) => {
    const userId = 1;
    const updateData = { handle: "updated_handle" };
    const uniqueConstraintError = createUniqueConstraintError(index);

    updateUserProfileMock.mockRejectedValue(uniqueConstraintError);

    const result = updateUserProfileService(userId, updateData);

    await expect(result).rejects.toBe(uniqueConstraintError);
  });
});

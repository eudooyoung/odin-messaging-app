import { beforeEach, describe, expect, it, vi } from "vitest";
import NotFoundError from "@/errors/notFoundError.js";
import { getUserProfileService } from "@/services/user.service.js";

const { findUserProfileByHandleMock } = vi.hoisted(() => ({
  findUserProfileByHandleMock: vi.fn(),
}));

vi.mock("@/repositories/user.repository.js", () => ({
  findUserProfileByHandle: findUserProfileByHandleMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getUserProfileService", () => {
  it("returns the user's public profile", async () => {
    const handle = "existing-user-handle";
    const userProfile = {
      id: 1,
      handle,
      displayName: "Existing User",
      bio: "Hello, I'm an existing user.",
      profileImage: "https://example.com/profile.jpg",
    };

    findUserProfileByHandleMock.mockResolvedValue(userProfile);

    const result = await getUserProfileService(handle);

    expect(findUserProfileByHandleMock).toHaveBeenCalledWith(handle);
    expect(result).toEqual(userProfile);
  });

  it("throws a not found error when the user does not exist", async () => {
    const handle = "missing-handle";

    findUserProfileByHandleMock.mockResolvedValue(null);

    const result = getUserProfileService(handle);

    expect(findUserProfileByHandleMock).toHaveBeenCalledWith(handle);
    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
  });
});

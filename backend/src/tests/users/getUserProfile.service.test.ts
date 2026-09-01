import { beforeEach, describe, expect, it, vi } from "vitest";
import NotFoundError from "@/errors/notFoundError.js";
import { getUserProfileService } from "@/services/user.service.js";

const { findUserProfileByUsernameMock } = vi.hoisted(() => ({
  findUserProfileByUsernameMock: vi.fn(),
}));

vi.mock("@/repositories/user.repository.js", () => ({
  findUserProfileByUsername: findUserProfileByUsernameMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getUserProfileService", () => {
  it("returns the user's public profile", async () => {
    const username = "existing-user";
    const userProfile = {
      username,
      displayName: "Existing User",
      bio: "Hello, I'm an existing user.",
      profileImage: "https://example.com/profile.jpg",
    };

    findUserProfileByUsernameMock.mockResolvedValue(userProfile);

    const result = await getUserProfileService(username);

    expect(findUserProfileByUsernameMock).toHaveBeenCalledWith(username);
    expect(result).toEqual(userProfile);
  });

  it("throws a not found error when the user does not exist", async () => {
    const username = "missing-user";

    findUserProfileByUsernameMock.mockResolvedValue(null);

    const result = getUserProfileService(username);

    expect(findUserProfileByUsernameMock).toHaveBeenCalledWith(username);
    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { searchUsers } from "@/repositories/user.repository.js";
import { searchUsersService } from "@/services/user.service.js";

const { searchUsersMock } = vi.hoisted(() => ({
  searchUsersMock: vi.fn<typeof searchUsers>(),
}));

vi.mock("@/repositories/user.repository.js", () => ({
  findUserProfileByUsername: vi.fn(),
  searchUsers: searchUsersMock,
  updateUserProfile: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("searchUsersService", () => {
  it("returns users matching the search query", async () => {
    const query = "alex";
    const users = [
      {
        username: "alex",
        displayName: "Alex Kim",
        profileImage: null,
      },
      {
        username: "another-user",
        displayName: "Alexandra Lee",
        profileImage: "https://example.com/alexandra.jpg",
      },
    ];

    searchUsersMock.mockResolvedValue(users);

    const result = await searchUsersService(query);

    expect(searchUsersMock).toHaveBeenCalledWith(query);
    expect(result).toEqual(users);
  });
});

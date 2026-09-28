import { beforeEach, describe, expect, it, vi } from "vitest";
import type { searchUsers } from "@/repositories/user.repository.js";
import { searchUsersService } from "@/services/user.service.js";

const { searchUsersMock } = vi.hoisted(() => ({
  searchUsersMock: vi.fn<typeof searchUsers>(),
}));

vi.mock("@/repositories/user.repository.js", () => ({
  searchUsers: searchUsersMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("searchUsersService", () => {
  it("passes the query to the repository and returns its results", async () => {
    const query = "alex";
    const users = [
      {
        handle: "other_user",
        displayName: "Other User",
        profileImage: null,
      },
    ];

    searchUsersMock.mockResolvedValue(users);

    const result = await searchUsersService(query);

    expect(searchUsersMock).toHaveBeenCalledWith(query);
    expect(result).toEqual(users);
  });
});

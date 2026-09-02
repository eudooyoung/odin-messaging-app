import { beforeEach, describe, expect, it, vi } from "vitest";
import UnauthorizedError from "@/errors/unauthorizedError.js";
import { getMeService } from "@/services/auth.service.js";
import type { findUserById } from "@/repositories/user.repository";

const { findUserByIdMock } = vi.hoisted(() => ({
  findUserByIdMock: vi.fn<typeof findUserById>(),
}));

vi.mock("@/repositories/user.repository.js", () => ({
  createUser: vi.fn(),
  findUserById: findUserByIdMock,
  findUserByUsername: vi.fn(),
}));

vi.mock("@/repositories/refreshSession.repository.js", () => ({
  createRefreshSession: vi.fn(),
  deleteRefreshSessionByTokenHash: vi.fn(),
  findRefreshSessionByTokenHash: vi.fn(),
  rotateRefreshSession: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getMeService", () => {
  it("returns the public fields of the user", async () => {
    const userId = 1;
    const user = {
      id: userId,
      username: "existing-user",
      displayName: "Existing User",
    };

    findUserByIdMock.mockResolvedValue(user);

    const result = await getMeService(userId);

    expect(findUserByIdMock).toHaveBeenCalledWith(userId);
    expect(result).toEqual({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    });
  });

  it("throws an authentication error when the user does not exist", async () => {
    const userId = 1;

    findUserByIdMock.mockResolvedValue(null);

    const result = getMeService(userId);

    expect(findUserByIdMock).toHaveBeenCalledWith(userId);
    await expect(result).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(result).rejects.toMatchObject({ statusCode: 401 });
  });
});

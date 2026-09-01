import * as argon2 from "argon2";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomError from "@/errors/customError.js";
import { findUserByUsername } from "@/repositories/user.repository.js";
import { loginService } from "@/services/auth.service.js";

type CreateRefreshSessionData = {
  tokenHash: string;
  userId: number;
  expiresAt: Date;
};

const { createRefreshSessionMock, signMock } = vi.hoisted(() => ({
  createRefreshSessionMock: vi.fn<(data: CreateRefreshSessionData) => unknown>(),
  signMock: vi.fn(),
}));

vi.mock("argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("argon2")>();

  return {
    ...actual,
    verify: vi.fn(),
  };
});

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: signMock,
  },
  sign: signMock,
}));

vi.mock("@/repositories/user.repository.js", () => ({
  createUser: vi.fn(),
  findUserByUsername: vi.fn(),
}));

vi.mock("@/repositories/refreshSession.repository.js", () => ({
  createRefreshSession: createRefreshSessionMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loginService", () => {
  it("verifies the password and returns access and refresh tokens", async () => {
    const input = {
      username: "existing-user",
      password: "secure-password",
    };
    const user = {
      id: 1,
      username: input.username,
      passwordHash: "hashed-password",
    };

    vi.mocked(findUserByUsername).mockResolvedValue(user);
    vi.mocked(argon2.verify).mockResolvedValue(true);
    signMock.mockReturnValueOnce("access-token").mockReturnValueOnce("refresh-token");

    const result = await loginService(input);

    expect(findUserByUsername).toHaveBeenCalledWith(input.username);
    expect(argon2.verify).toHaveBeenCalledWith(user.passwordHash, input.password);
    expect(signMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  it("stores a SHA-256 hash of the refresh token with its user and expiration", async () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    const refreshToken = "plaintext-refresh-token";
    const input = {
      username: "existing-user",
      password: "secure-password",
    };
    const user = {
      id: 1,
      username: input.username,
      passwordHash: "hashed-password",
    };

    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(findUserByUsername).mockResolvedValue(user);
    vi.mocked(argon2.verify).mockResolvedValue(true);
    signMock.mockReturnValueOnce("access-token").mockReturnValueOnce(refreshToken);

    await loginService(input);

    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    expect(createRefreshSessionMock).toHaveBeenCalledOnce();
    expect(createRefreshSessionMock).toHaveBeenCalledWith({
      tokenHash,
      userId: user.id,
      expiresAt,
    });
    const persistedSession = createRefreshSessionMock.mock.calls[0]?.[0];
    expect(Object.values(persistedSession ?? {})).not.toContain(refreshToken);
  });

  it("throws an authentication error when the user does not exist", async () => {
    const input = {
      username: "missing-user",
      password: "secure-password",
    };

    vi.mocked(findUserByUsername).mockResolvedValue(null);

    const result = loginService(input);

    await expect(result).rejects.toBeInstanceOf(CustomError);
    await expect(result).rejects.toMatchObject({ statusCode: 401 });
    expect(argon2.verify).not.toHaveBeenCalled();
    expect(signMock).not.toHaveBeenCalled();
  });

  it("throws the same authentication error when the password does not match", async () => {
    const input = {
      username: "existing-user",
      password: "wrong-password",
    };
    const user = {
      id: 1,
      username: input.username,
      passwordHash: "hashed-password",
    };

    vi.mocked(findUserByUsername).mockResolvedValue(user);
    vi.mocked(argon2.verify).mockResolvedValue(false);

    const result = loginService(input);

    await expect(result).rejects.toBeInstanceOf(CustomError);
    await expect(result).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid credentials",
    });
    expect(argon2.verify).toHaveBeenCalledWith(user.passwordHash, input.password);
    expect(signMock).not.toHaveBeenCalled();
  });
});

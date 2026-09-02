import { createHash } from "node:crypto";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/config/env.config.js";
import UnauthorizedError from "@/errors/unauthorizedError.js";
import { refreshService } from "@/services/auth.service.js";

type RefreshSession = {
  userId: number;
  expiresAt: Date;
};

type RotateRefreshSessionData = {
  previousTokenHash: string;
  tokenHash: string;
  userId: number;
  expiresAt: Date;
};

const {
  findRefreshSessionByTokenHashMock,
  randomUUIDMock,
  rotateRefreshSessionMock,
  signMock,
  verifyMock,
} = vi.hoisted(() => ({
  findRefreshSessionByTokenHashMock: vi.fn<
    (tokenHash: string) => Promise<RefreshSession | null>
  >(),
  randomUUIDMock: vi.fn(),
  rotateRefreshSessionMock: vi.fn<
    (data: RotateRefreshSessionData) => Promise<unknown>
  >(),
  signMock: vi.fn(),
  verifyMock: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();

  return {
    ...actual,
    randomUUID: randomUUIDMock,
  };
});

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: signMock,
    verify: verifyMock,
  },
  sign: signMock,
  verify: verifyMock,
}));

vi.mock("@/repositories/user.repository.js", () => ({
  createUser: vi.fn(),
  findUserByUsername: vi.fn(),
}));

vi.mock("@/repositories/refreshSession.repository.js", () => ({
  createRefreshSession: vi.fn(),
  deleteRefreshSessionByTokenHash: vi.fn(),
  findRefreshSessionByTokenHash: findRefreshSessionByTokenHashMock,
  rotateRefreshSession: rotateRefreshSessionMock,
}));

const now = new Date("2026-09-01T00:00:00.000Z");
const userId = 1;
const refreshToken = "current-refresh-token";
const newAccessToken = "new-access-token";
const newRefreshToken = "new-refresh-token";

const expectAuthenticationError = async (result: Promise<unknown>) => {
  await expect(result).rejects.toBeInstanceOf(UnauthorizedError);
  await expect(result).rejects.toMatchObject({
    statusCode: 401,
    code: "INVALID_REFRESH_TOKEN",
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  verifyMock.mockReturnValue({ sub: String(userId), tokenType: "refresh" });
  findRefreshSessionByTokenHashMock.mockResolvedValue({
    userId,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  });
  randomUUIDMock.mockReturnValueOnce("access-jti").mockReturnValueOnce("refresh-jti");
  signMock.mockReturnValueOnce(newAccessToken).mockReturnValueOnce(newRefreshToken);
  rotateRefreshSessionMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("refreshService", () => {
  it("verifies the current token and rotates it with a new refresh session", async () => {
    const previousTokenHash = createHash("sha256").update(refreshToken).digest("hex");
    const tokenHash = createHash("sha256").update(newRefreshToken).digest("hex");

    const result = await refreshService(refreshToken);

    expect(verifyMock).toHaveBeenCalledWith(refreshToken, env.jwtSecret);
    expect(findRefreshSessionByTokenHashMock).toHaveBeenCalledWith(previousTokenHash);
    expect(signMock).toHaveBeenNthCalledWith(
      1,
      { sub: String(userId), tokenType: "access" },
      env.jwtSecret,
      { expiresIn: "15m", jwtid: "access-jti" },
    );
    expect(signMock).toHaveBeenNthCalledWith(
      2,
      { sub: String(userId), tokenType: "refresh" },
      env.jwtSecret,
      { expiresIn: "7d", jwtid: "refresh-jti" },
    );
    expect(rotateRefreshSessionMock).toHaveBeenCalledWith({
      previousTokenHash,
      tokenHash,
      userId,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
    expect(result).toEqual({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  });

  it("throws an authentication error when the refresh token is missing", async () => {
    await expectAuthenticationError(refreshService(undefined));

    expect(verifyMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: "verification fails",
      error: new Error("Invalid token"),
    },
    {
      caseName: "the JWT is expired",
      error: Object.assign(new Error("jwt expired"), { name: "TokenExpiredError" }),
    },
  ])("throws an authentication error when $caseName", async ({ error }) => {
    verifyMock.mockImplementation(() => {
      throw error;
    });

    await expectAuthenticationError(refreshService(refreshToken));

    expect(findRefreshSessionByTokenHashMock).not.toHaveBeenCalled();
  });

  it("throws an authentication error when the token type is not refresh", async () => {
    verifyMock.mockReturnValue({ sub: String(userId), tokenType: "access" });

    await expectAuthenticationError(refreshService(refreshToken));

    expect(findRefreshSessionByTokenHashMock).not.toHaveBeenCalled();
  });

  it("throws an authentication error when sub is not a valid user id", async () => {
    verifyMock.mockReturnValue({ sub: "not-a-user-id", tokenType: "refresh" });

    await expectAuthenticationError(refreshService(refreshToken));

    expect(findRefreshSessionByTokenHashMock).not.toHaveBeenCalled();
  });

  it("throws an authentication error when the refresh session does not exist", async () => {
    findRefreshSessionByTokenHashMock.mockResolvedValue(null);

    await expectAuthenticationError(refreshService(refreshToken));

    expect(signMock).not.toHaveBeenCalled();
    expect(rotateRefreshSessionMock).not.toHaveBeenCalled();
  });

  it("throws an authentication error when the JWT user and session user do not match", async () => {
    findRefreshSessionByTokenHashMock.mockResolvedValue({
      userId: userId + 1,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });

    await expectAuthenticationError(refreshService(refreshToken));

    expect(signMock).not.toHaveBeenCalled();
    expect(rotateRefreshSessionMock).not.toHaveBeenCalled();
  });

  it("throws an authentication error when the refresh session is expired", async () => {
    findRefreshSessionByTokenHashMock.mockResolvedValue({
      userId,
      expiresAt: now,
    });

    await expectAuthenticationError(refreshService(refreshToken));

    expect(signMock).not.toHaveBeenCalled();
    expect(rotateRefreshSessionMock).not.toHaveBeenCalled();
  });

  it("converts a missing session error during rotation to an authentication error", async () => {
    const missingSessionError = new PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "test",
    });

    rotateRefreshSessionMock.mockRejectedValue(missingSessionError);

    await expectAuthenticationError(refreshService(refreshToken));
  });

  it("rethrows an unexpected rotation error", async () => {
    const unexpectedError = new Error("Database unavailable");

    rotateRefreshSessionMock.mockRejectedValue(unexpectedError);

    await expect(refreshService(refreshToken)).rejects.toBe(unexpectedError);
  });
});

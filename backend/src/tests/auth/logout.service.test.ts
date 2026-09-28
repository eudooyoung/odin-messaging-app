import { createHash } from "node:crypto";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { deleteRefreshSessionByTokenHash } from "@/repositories/refreshSession.repository.js";
import { logoutService } from "@/services/auth.service.js";

const { deleteRefreshSessionByTokenHashMock } = vi.hoisted(() => ({
  deleteRefreshSessionByTokenHashMock: vi.fn<typeof deleteRefreshSessionByTokenHash>(),
}));

vi.mock("@/repositories/refreshSession.repository.js", () => ({
  deleteRefreshSessionByTokenHash: deleteRefreshSessionByTokenHashMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("logoutService", () => {
  it("hashes the refresh token and deletes its refresh session", async () => {
    const refreshToken = "valid-refresh-token";
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");

    deleteRefreshSessionByTokenHashMock.mockResolvedValue({
      id: 1,
      tokenHash,
      userId: 1,
      expiresAt: new Date("2026-09-08T00:00:00.000Z"),
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    });

    await expect(logoutService(refreshToken)).resolves.toBeUndefined();
    expect(deleteRefreshSessionByTokenHashMock).toHaveBeenCalledWith(tokenHash);
  });

  it("does not call the repository when the refresh token is missing", async () => {
    await expect(logoutService(undefined)).resolves.toBeUndefined();

    expect(deleteRefreshSessionByTokenHashMock).not.toHaveBeenCalled();
  });

  it("completes successfully when the refresh session was already deleted", async () => {
    const missingSessionError = new PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "test",
    });

    deleteRefreshSessionByTokenHashMock.mockRejectedValue(missingSessionError);

    await expect(logoutService("already-used-refresh-token")).resolves.toBeUndefined();
  });

  it("rethrows an unexpected repository error", async () => {
    const unexpectedError = new Error("Database unavailable");

    deleteRefreshSessionByTokenHashMock.mockRejectedValue(unexpectedError);

    await expect(logoutService("valid-refresh-token")).rejects.toBe(unexpectedError);
  });
});

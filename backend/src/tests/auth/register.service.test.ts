import * as argon2 from "argon2";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConflictError from "../../errors/conflictError.js";
import { createUser } from "../../repositories/user.repository.js";
import { registerService } from "../../services/auth.service.js";

vi.mock("argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("argon2")>();

  return {
    ...actual,
    hash: vi.fn(),
  };
});

vi.mock("../../repositories/user.repository.js", () => ({
  createUser: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("registerService", () => {
  it("hashes the password and creates a user", async () => {
    const input = {
      username: "new-user",
      password: "secure-password",
      displayName: "New User",
    };
    const createdUser = {
      id: 1,
      username: input.username,
      displayName: input.displayName,
    };

    vi.mocked(argon2.hash).mockResolvedValue("hashed-password");
    vi.mocked(createUser).mockResolvedValue(createdUser);

    const result = await registerService(input);

    expect(argon2.hash).toHaveBeenCalledWith(input.password, {
      type: argon2.argon2id,
    });
    expect(createUser).toHaveBeenCalledWith({
      username: input.username,
      passwordHash: "hashed-password",
      displayName: input.displayName,
    });
    expect(result).toBe(createdUser);
  });

  it("converts a duplicate username error to ConflictError", async () => {
    const input = {
      username: "existing-user",
      password: "secure-password",
      displayName: "Existing User",
    };
    const duplicateUsernameError = new PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
      },
    );

    vi.mocked(argon2.hash).mockResolvedValue("hashed-password");
    vi.mocked(createUser).mockRejectedValue(duplicateUsernameError);

    const result = registerService(input);

    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toMatchObject({
      code: "USERNAME_ALREADY_EXISTS",
    });
  });
});

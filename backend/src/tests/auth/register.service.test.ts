import * as argon2 from "argon2";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConflictError from "@/errors/conflictError.js";
import { createUser } from "@/repositories/user.repository.js";
import { registerService } from "@/services/auth.service.js";

vi.mock("argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("argon2")>();

  return {
    ...actual,
    hash: vi.fn(),
  };
});

vi.mock("@/repositories/user.repository.js", () => ({
  createUser: vi.fn(),
}));

const registerInput = {
  username: "new-user",
  password: "secure-password",
  displayName: "New User",
};
const hashedPassword = "hashed-password";
const initialHandlePattern = /^user_[a-z0-9]{8}$/;
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

const createRegisteredUser = (handle: string) => ({
  id: 1,
  username: registerInput.username,
  handle,
  displayName: registerInput.displayName,
});

describe("registerService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(argon2.hash).mockResolvedValue(hashedPassword);
  });

  it("generates an initial handle, hashes the password, and creates a user", async () => {
    const createdUser = createRegisteredUser("user_a1b2c3d4");

    vi.mocked(createUser).mockResolvedValue(createdUser);

    const result = await registerService(registerInput);
    const initialHandleMatcher: unknown = expect.stringMatching(initialHandlePattern);

    expect(argon2.hash).toHaveBeenCalledWith(registerInput.password, {
      type: argon2.argon2id,
    });
    expect(createUser).toHaveBeenCalledWith({
      username: registerInput.username,
      passwordHash: hashedPassword,
      handle: initialHandleMatcher,
      displayName: registerInput.displayName,
    });
    expect(result).toBe(createdUser);
  });

  it("retries with a new initial handle when the handle is already in use", async () => {
    const handleCollisionError = createUniqueConstraintError(uniqueConstraintIndexes.handle);
    const createdUser = createRegisteredUser("user_e5f6g7h8");

    vi.mocked(createUser)
      .mockRejectedValueOnce(handleCollisionError)
      .mockResolvedValueOnce(createdUser);

    const result = await registerService(registerInput);
    const attemptedHandles = vi.mocked(createUser).mock.calls.map(([userData]) => userData.handle);
    const initialHandleMatcher: unknown = expect.stringMatching(initialHandlePattern);

    expect(attemptedHandles).toEqual([initialHandleMatcher, initialHandleMatcher]);
    expect(new Set(attemptedHandles).size).toBe(2);
    expect(argon2.hash).toHaveBeenCalledOnce();
    expect(result).toBe(createdUser);
  });

  it("rethrows the last handle collision after reaching the maximum attempts", async () => {
    const maxHandleCreationAttempts = 5;
    const lastHandleCollisionError = createUniqueConstraintError(uniqueConstraintIndexes.handle);
    const handleCollisionErrors = [
      ...Array.from({ length: maxHandleCreationAttempts - 1 }, () =>
        createUniqueConstraintError(uniqueConstraintIndexes.handle),
      ),
      lastHandleCollisionError,
    ];

    for (const handleCollisionError of handleCollisionErrors) {
      vi.mocked(createUser).mockRejectedValueOnce(handleCollisionError);
    }

    const result = registerService(registerInput);

    await expect(result).rejects.toBe(lastHandleCollisionError);

    const attemptedHandles = vi.mocked(createUser).mock.calls.map(([userData]) => userData.handle);
    const initialHandleMatcher: unknown = expect.stringMatching(initialHandlePattern);
    const expectedHandles = Array.from(
      { length: maxHandleCreationAttempts },
      () => initialHandleMatcher,
    );

    expect(attemptedHandles).toEqual(expectedHandles);
    expect(new Set(attemptedHandles).size).toBe(maxHandleCreationAttempts);
    expect(argon2.hash).toHaveBeenCalledOnce();
  });

  it("converts a duplicate username error to ConflictError", async () => {
    const input = {
      ...registerInput,
      username: "existing-user",
      displayName: "Existing User",
    };
    const duplicateUsernameError = createUniqueConstraintError(uniqueConstraintIndexes.username);

    vi.mocked(createUser).mockRejectedValue(duplicateUsernameError);

    const result = registerService(input);

    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toMatchObject({
      code: "USERNAME_ALREADY_EXISTS",
    });
    expect(createUser).toHaveBeenCalledOnce();
  });
});

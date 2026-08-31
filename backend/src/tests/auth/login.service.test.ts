import * as argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomError from "@/errors/customError.js";
import { findUserByUsername } from "@/repositories/user.repository.js";
import { loginService } from "@/services/auth.service.js";

const { signMock } = vi.hoisted(() => ({
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

beforeEach(() => {
  vi.resetAllMocks();
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
    signMock
      .mockReturnValueOnce("access-token")
      .mockReturnValueOnce("refresh-token");

    const result = await loginService(input);

    expect(findUserByUsername).toHaveBeenCalledWith(input.username);
    expect(argon2.verify).toHaveBeenCalledWith(
      user.passwordHash,
      input.password,
    );
    expect(signMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
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
    expect(argon2.verify).toHaveBeenCalledWith(
      user.passwordHash,
      input.password,
    );
    expect(signMock).not.toHaveBeenCalled();
  });
});

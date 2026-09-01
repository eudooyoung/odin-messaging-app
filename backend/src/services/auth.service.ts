import * as argon2 from "argon2";
import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { createUser, findUserById, findUserByUsername } from "@/repositories/user.repository.js";
import type { LoginInput, RegisterInput } from "@/types/api.types";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import ConflictError from "@/errors/conflictError";
import { env } from "@/config/env.config.js";
import UnauthorizedError from "@/errors/unauthorizedError";
import {
  createRefreshSession,
  deleteRefreshSessionByTokenHash,
  findRefreshSessionByTokenHash,
  rotateRefreshSession,
} from "@/repositories/refreshSession.repository";

const refreshTokenLifetime = 7 * 24 * 60 * 60 * 1000;

const createRefreshTokenHash = (refreshToken: string) =>
  createHash("sha256").update(refreshToken).digest("hex");

const createRefreshUnauthorizedError = () =>
  new UnauthorizedError("Invalid refresh token", "INVALID_REFRESH_TOKEN");

export const registerService = async ({ username, password, displayName }: RegisterInput) => {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  try {
    return await createUser({
      username,
      passwordHash,
      displayName,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Username already exists", "USERNAME_ALREADY_EXISTS");
    }

    throw error;
  }
};

export const loginService = async ({ username, password }: LoginInput) => {
  const user = await findUserByUsername(username);

  if (!user) {
    throw new UnauthorizedError("Invalid credentials", "INVALID_CREDENTIALS");
  }

  const passwordMatches = await argon2.verify(user.passwordHash, password);

  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid credentials", "INVALID_CREDENTIALS");
  }

  const accessToken = jwt.sign({ sub: String(user.id), tokenType: "access" }, env.jwtSecret, {
    expiresIn: "15m",
    jwtid: randomUUID(),
  });
  const refreshToken = jwt.sign({ sub: String(user.id), tokenType: "refresh" }, env.jwtSecret, {
    expiresIn: "7d",
    jwtid: randomUUID(),
  });
  const tokenHash = createRefreshTokenHash(refreshToken);
  const expiresAt = new Date(Date.now() + refreshTokenLifetime);

  await createRefreshSession({
    tokenHash,
    userId: user.id,
    expiresAt,
  });

  return { accessToken, refreshToken };
};

export const refreshService = async (refreshToken: string | undefined) => {
  if (!refreshToken) {
    throw createRefreshUnauthorizedError();
  }

  let userId: number;

  try {
    const payload = jwt.verify(refreshToken, env.jwtSecret);

    if (
      typeof payload === "string" ||
      payload.tokenType !== "refresh" ||
      typeof payload.sub !== "string"
    ) {
      throw createRefreshUnauthorizedError();
    }

    userId = Number(payload.sub);

    if (!Number.isInteger(userId)) {
      throw createRefreshUnauthorizedError();
    }
  } catch {
    throw createRefreshUnauthorizedError();
  }

  const previousTokenHash = createRefreshTokenHash(refreshToken);
  const refreshSession = await findRefreshSessionByTokenHash(previousTokenHash);

  if (
    !refreshSession ||
    refreshSession.userId !== userId ||
    refreshSession.expiresAt <= new Date()
  ) {
    throw createRefreshUnauthorizedError();
  }

  const accessToken = jwt.sign({ sub: String(userId), tokenType: "access" }, env.jwtSecret, {
    expiresIn: "15m",
    jwtid: randomUUID(),
  });
  const nextRefreshToken = jwt.sign({ sub: String(userId), tokenType: "refresh" }, env.jwtSecret, {
    expiresIn: "7d",
    jwtid: randomUUID(),
  });
  const tokenHash = createRefreshTokenHash(nextRefreshToken);
  const expiresAt = new Date(Date.now() + refreshTokenLifetime);

  try {
    await rotateRefreshSession({
      previousTokenHash,
      tokenHash,
      userId,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      throw createRefreshUnauthorizedError();
    }

    throw error;
  }

  return { accessToken, refreshToken: nextRefreshToken };
};

export const logoutService = async (refreshToken: string | undefined) => {
  if (!refreshToken) {
    return;
  }

  const tokenHash = createRefreshTokenHash(refreshToken);

  try {
    await deleteRefreshSessionByTokenHash(tokenHash);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      return;
    }

    throw error;
  }
};

export const getMeService = async (userId: number) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new UnauthorizedError("Invalid credentials", "INVALID_CREDENTIALS");
  }

  return user;
};

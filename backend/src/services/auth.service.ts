import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByUsername,
} from "@/repositories/user.repository.js";
import type { LoginInput, RegisterInput } from "@/types/api.types";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import ConflictError from "@/errors/conflictError";
import { env } from "@/config/env.config.js";
import UnauthorizedError from "@/errors/unauthorizedError";

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

  const accessToken = jwt.sign(
    { sub: String(user.id), tokenType: "access" },
    env.jwtSecret,
  );
  const refreshToken = jwt.sign(
    { sub: String(user.id), tokenType: "refresh" },
    env.jwtSecret,
  );

  return { accessToken, refreshToken };
};

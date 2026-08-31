import * as argon2 from "argon2";
import { createUser } from "../repositories/user.repository.js";
import type { RegisterInput } from "@/types/api.types";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import ConflictError from "@/errors/conflictError";

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

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import NotFoundError from "@/errors/notFoundError.js";
import UnauthorizedError from "@/errors/unauthorizedError.js";
import {
  findUserProfileByUsername,
  searchUsers,
  updateUserProfile,
} from "@/repositories/user.repository.js";
import type { UpdateUserProfileInput } from "@/types/api.types.js";

export const getUserProfileService = async (username: string) => {
  const userProfile = await findUserProfileByUsername(username);

  if (!userProfile) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  return userProfile;
};

export const updateUserProfileService = async (
  userId: number,
  updateData: UpdateUserProfileInput,
) => {
  try {
    return await updateUserProfile(userId, updateData);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      throw new UnauthorizedError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    throw error;
  }
};

export const searchUsersService = async (query: string) => {
  const users = await searchUsers(query);

  return users;
};

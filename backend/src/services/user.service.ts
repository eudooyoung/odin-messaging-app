import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import ConflictError from "@/errors/conflictError.js";
import NotFoundError from "@/errors/notFoundError.js";
import UnauthorizedError from "@/errors/unauthorizedError.js";
import { isHandleUniqueConstraintError } from "@/lib/handleUniqueConstraint.js";
import {
  findUserProfileByHandle,
  searchUsers,
  updateUserProfile,
} from "@/repositories/user.repository.js";
import type { UpdateUserProfileInput } from "@/types/api.types.js";

export const getUserProfileService = async (handle: string) => {
  const userProfile = await findUserProfileByHandle(handle);

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
    if (isHandleUniqueConstraintError(error)) {
      throw new ConflictError("Handle already exists", "HANDLE_ALREADY_EXISTS");
    }

    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      throw new UnauthorizedError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    throw error;
  }
};

export const searchUsersService = async (query: string, currentUserId: number) => {
  const users = await searchUsers(query, currentUserId);

  return users;
};

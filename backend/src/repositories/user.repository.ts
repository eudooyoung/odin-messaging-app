import type { CreateUserData, UpdateUserProfileInput } from "@/types/api.types";
import { prisma } from "@/lib/prisma.js";

export const createUser = ({ username, passwordHash, displayName }: CreateUserData) =>
  prisma.user.create({
    data: {
      username,
      passwordHash,
      displayName,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  });

export const findUserByUsername = (username: string) =>
  prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      passwordHash: true,
    },
  });

export const findUserById = (userId: number) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  });

export const findUserProfileByUsername = (username: string) =>
  prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      displayName: true,
      bio: true,
      profileImage: true,
    },
  });

export const updateUserProfile = (userId: number, updateData: UpdateUserProfileInput) =>
  prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      username: true,
      displayName: true,
      bio: true,
      profileImage: true,
    },
  });

export const searchUsers = (query: string) =>
  prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      username: true,
      displayName: true,
      profileImage: true,
    },
  });

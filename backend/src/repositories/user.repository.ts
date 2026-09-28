import type { CreateUserData, UpdateUserProfileInput } from "@/types/api.types";
import { prisma } from "@/lib/prisma.js";

export const createUser = ({ username, handle, passwordHash, displayName }: CreateUserData) =>
  prisma.user.create({
    data: {
      username,
      handle,
      passwordHash,
      displayName,
    },
    select: {
      id: true,
      username: true,
      handle: true,
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

export const findUserByHandle = (handle: string) =>
  prisma.user.findUnique({
    where: { handle },
    select: {
      id: true,
      handle: true,
    },
  });

export const findUserById = (userId: number) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      handle: true,
      displayName: true,
    },
  });

export const findUserProfileByHandle = (handle: string) =>
  prisma.user.findUnique({
    where: { handle },
    select: {
      id: true,
      handle: true,
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
      handle: true,
      displayName: true,
      bio: true,
      profileImage: true,
    },
  });

export const searchUsers = (query: string, currentUserId: number) =>
  prisma.user.findMany({
    where: {
      id: { not: currentUserId },
      OR: [
        { handle: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      handle: true,
      displayName: true,
      profileImage: true,
    },
  });

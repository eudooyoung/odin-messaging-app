import type { CreateUserData } from "@/types/api.types";
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

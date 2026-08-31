import type { CreateUserData } from "@/types/api.types";
import { prisma } from "../lib/prisma.js";

export const createUser = ({
  username,
  passwordHash,
  displayName,
}: CreateUserData) =>
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

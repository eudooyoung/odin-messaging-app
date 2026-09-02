import { prisma } from "@/lib/prisma";
import type {
  CreateRefreshSessionData,
  RotateRefreshSessionData,
} from "@/types/api.types";

export const createRefreshSession = ({ tokenHash, userId, expiresAt }: CreateRefreshSessionData) =>
  prisma.refreshSession.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

export const findRefreshSessionByTokenHash = (tokenHash: string) =>
  prisma.refreshSession.findUnique({
    where: { tokenHash },
    select: {
      userId: true,
      expiresAt: true,
    },
  });

export const deleteRefreshSessionByTokenHash = (tokenHash: string) =>
  prisma.refreshSession.delete({
    where: { tokenHash },
  });

export const rotateRefreshSession = ({
  previousTokenHash,
  tokenHash,
  userId,
  expiresAt,
}: RotateRefreshSessionData) =>
  prisma.$transaction(async (transaction) => {
    await transaction.refreshSession.delete({
      where: { tokenHash: previousTokenHash },
    });

    return transaction.refreshSession.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });
  });

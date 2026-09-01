import { prisma } from "@/lib/prisma.js";

export const findConversationByParticipantIds = (participantIds: number[]) =>
  prisma.conversation.findFirst({
    where: {
      AND: [
        ...participantIds.map((id) => ({
          participants: {
            some: { id },
          },
        })),
        {
          participants: {
            every: {
              id: { in: participantIds },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      participants: {
        select: {
          username: true,
          displayName: true,
          profileImage: true,
        },
      },
      createdAt: true,
      lastActivityAt: true,
    },
  });

export const createConversation = (participantIds: number[]) =>
  prisma.conversation.create({
    data: {
      participants: {
        connect: participantIds.map((id) => ({ id })),
      },
    },
    select: {
      id: true,
      participants: {
        select: {
          username: true,
          displayName: true,
          profileImage: true,
        },
      },
      createdAt: true,
      lastActivityAt: true,
    },
  });

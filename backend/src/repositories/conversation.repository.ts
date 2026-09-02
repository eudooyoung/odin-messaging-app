import { prisma } from "@/lib/prisma.js";

export const findConversationById = (conversationId: number) =>
  prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      participants: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImage: true,
        },
      },
      createdAt: true,
      lastActivityAt: true,
    },
  });

export const updateConversationLastActivityAt = (
  conversationId: number,
  lastActivityAt: Date,
) =>
  prisma.conversation.update({
    where: { id: conversationId },
    data: { lastActivityAt },
  });

export const findConversationsByParticipantId = (
  participantId: number,
  cursor?: number,
  limit?: number,
) =>
  prisma.conversation.findMany({
    where: {
      participants: {
        some: { id: participantId },
      },
    },
    select: {
      id: true,
      participants: {
        where: {
          id: { not: participantId },
        },
        select: {
          username: true,
          displayName: true,
          profileImage: true,
        },
      },
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
        },
      },
      lastActivityAt: true,
    },
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    ...(cursor === undefined
      ? {}
      : {
          cursor: { id: cursor },
          skip: 1,
        }),
    ...(limit === undefined ? {} : { take: limit + 1 }),
  });

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

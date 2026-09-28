import { prisma } from "@/lib/prisma.js";
import type { Prisma } from "@/generated/prisma/client.js";

export const findConversationById = (conversationId: number) =>
  prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      participants: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          profileImage: true,
        },
      },
      createdAt: true,
      lastActivityAt: true,
    },
  });

export const updateConversationLastActivityAt = (conversationId: number, lastActivityAt: Date) =>
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
          id: true,
          handle: true,
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

export const findConversationByParticipantIds = (
  participantIds: number[],
  client: Prisma.TransactionClient = prisma,
) =>
  client.conversation.findFirst({
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
          id: true,
          handle: true,
          displayName: true,
          profileImage: true,
        },
      },
      createdAt: true,
      lastActivityAt: true,
    },
  });

export const createConversation = (
  participantIds: number[],
  client: Prisma.TransactionClient = prisma,
) =>
  client.conversation.create({
    data: {
      participants: {
        connect: participantIds.map((id) => ({ id })),
      },
    },
    select: {
      id: true,
      participants: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          profileImage: true,
        },
      },
      createdAt: true,
      lastActivityAt: true,
    },
  });

export const findOrCreateConversation = (participantIds: number[]) =>
  prisma.$transaction(
    async (transaction) => {
      const existingConversation = await findConversationByParticipantIds(
        participantIds,
        transaction,
      );

      if (existingConversation) {
        return { conversation: existingConversation, created: false };
      }

      const conversation = await createConversation(participantIds, transaction);

      return { conversation, created: true };
    },
    { isolationLevel: "Serializable" },
  );

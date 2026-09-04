import { prisma } from "@/lib/prisma.js";

export const findMessagesByConversationId = (
  conversationId: number,
  cursor?: number,
  limit?: number,
) =>
  prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      content: true,
      sender: {
        select: {
          username: true,
          displayName: true,
          profileImage: true,
        },
      },
      createdAt: true,
    },
    ...(cursor === undefined
      ? {}
      : {
          cursor: { id: cursor },
          skip: 1,
        }),
    ...(limit === undefined ? {} : { take: limit + 1 }),
  });

export const createMessage = (conversationId: number, senderId: number, content: string) =>
  prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
    },
    select: {
      id: true,
      content: true,
      sender: {
        select: {
          username: true,
          displayName: true,
          profileImage: true,
        },
      },
      createdAt: true,
    },
  });

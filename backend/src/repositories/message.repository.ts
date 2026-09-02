import { prisma } from "@/lib/prisma.js";

export const createMessage = (
  conversationId: number,
  senderId: number,
  content: string,
) =>
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

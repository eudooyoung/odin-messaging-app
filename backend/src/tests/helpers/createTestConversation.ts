import { prisma } from "@/lib/prisma.js";

type CreateTestConversationInput = {
  participantIds: [number, number];
  lastActivityAt?: Date;
};

export const createTestConversation = ({
  participantIds,
  lastActivityAt,
}: CreateTestConversationInput) =>
  prisma.conversation.create({
    data: {
      participants: {
        connect: participantIds.map((id) => ({ id })),
      },
      ...(lastActivityAt === undefined ? {} : { lastActivityAt }),
    },
  });

import { createConversationService } from "@/services/conversation.service.js";
import type { CreateConversationHandler } from "@/types/handler.types.js";

export const createConversationController: CreateConversationHandler = async (req, res) => {
  const { conversation, created } = await createConversationService(
    res.locals.userId,
    req.body.targetUsername,
  );

  res.status(created ? 201 : 200).json({
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    lastActivityAt: conversation.lastActivityAt.toISOString(),
  });
};

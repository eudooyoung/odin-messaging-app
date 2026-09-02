import { createMessageService } from "@/services/message.service.js";
import type { CreateMessageHandler } from "@/types/handler.types.js";

export const createMessageController: CreateMessageHandler = async (req, res) => {
  const message = await createMessageService(
    res.locals.userId,
    res.locals.conversationId,
    req.body.content,
  );

  res.status(201).json({
    ...message,
    createdAt: message.createdAt.toISOString(),
  });
};

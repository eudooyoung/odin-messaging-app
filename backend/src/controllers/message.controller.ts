import {
  createMessageService,
  getMessagesService,
} from "@/services/message.service.js";
import type {
  CreateMessageHandler,
  GetMessagesHandler,
} from "@/types/handler.types.js";

export const getMessagesController: GetMessagesHandler = async (_req, res) => {
  const { messages, nextCursor } = await getMessagesService(
    res.locals.userId,
    res.locals.conversationId,
    res.locals.cursor,
    res.locals.limit,
  );

  res.status(200).json({
    messages: messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
    nextCursor,
  });
};

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

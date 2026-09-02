import { createMessageService, getMessagesService } from "@/services/message.service.js";
import type { CreateMessageHandler, GetMessagesHandler } from "@/types/handler.types.js";
import type { MessageCreatedPublisher } from "@/types/websocket.types.js";

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

export const createMessageController =
  (publishMessageCreated: MessageCreatedPublisher): CreateMessageHandler =>
  async (req, res) => {
    const { message, recipientUserIds } = await createMessageService(
      res.locals.userId,
      res.locals.conversationId,
      req.body.content,
    );
    const responseBody = {
      ...message,
      createdAt: message.createdAt.toISOString(),
    };

    publishMessageCreated(recipientUserIds, res.locals.conversationId, responseBody);

    res.status(201).json(responseBody);
  };

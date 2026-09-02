import { Router } from "express";
import {
  createConversationController,
  getConversationController,
  getConversationsController,
} from "@/controllers/conversation.controller.js";
import {
  createMessageController,
  getMessagesController,
} from "@/controllers/message.controller.js";
import { authenticateAccessToken } from "@/middleware/accessToken.authentication.middleware.js";
import { validateCreateConversation } from "@/middleware/createConversation.validation.middleware.js";
import { validateCreateMessage } from "@/middleware/createMessage.validation.middleware.js";
import { validateGetConversation } from "@/middleware/getConversation.validation.middleware.js";
import { validateGetConversations } from "@/middleware/getConversations.validation.middleware.js";
import { validateGetMessages } from "@/middleware/getMessages.validation.middleware.js";
import type { MessageCreatedPublisher } from "@/types/websocket.types.js";

export const createConversationRouter = (publishMessageCreated: MessageCreatedPublisher) => {
  const conversationRouter = Router();

  conversationRouter.get(
    "/",
    authenticateAccessToken,
    validateGetConversations,
    getConversationsController,
  );
  conversationRouter.get(
    "/:id/messages",
    authenticateAccessToken,
    validateGetMessages,
    getMessagesController,
  );
  conversationRouter.get(
    "/:id",
    authenticateAccessToken,
    validateGetConversation,
    getConversationController,
  );

  conversationRouter.post(
    "/:id/messages",
    authenticateAccessToken,
    validateCreateMessage,
    createMessageController(publishMessageCreated),
  );

  conversationRouter.post(
    "/",
    authenticateAccessToken,
    validateCreateConversation,
    createConversationController,
  );

  return conversationRouter;
};

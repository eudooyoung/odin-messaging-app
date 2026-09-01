import { Router } from "express";
import {
  createConversationController,
  getConversationController,
  getConversationsController,
} from "@/controllers/conversation.controller.js";
import { authenticateAccessToken } from "@/middleware/accessToken.authentication.middleware.js";
import { validateCreateConversation } from "@/middleware/createConversation.validation.middleware.js";
import { validateGetConversation } from "@/middleware/getConversation.validation.middleware.js";
import { validateGetConversations } from "@/middleware/getConversations.validation.middleware.js";

const conversationRouter = Router();

conversationRouter.get(
  "/",
  authenticateAccessToken,
  validateGetConversations,
  getConversationsController,
);
conversationRouter.get(
  "/:id",
  authenticateAccessToken,
  validateGetConversation,
  getConversationController,
);

conversationRouter.post(
  "/",
  authenticateAccessToken,
  validateCreateConversation,
  createConversationController,
);

export default conversationRouter;

import { Router } from "express";
import {
  createConversationController,
  getConversationsController,
} from "@/controllers/conversation.controller.js";
import { authenticateAccessToken } from "@/middleware/accessToken.authentication.middleware.js";
import { validateCreateConversation } from "@/middleware/createConversation.validation.middleware.js";
import { validateGetConversations } from "@/middleware/getConversations.validation.middleware.js";

const conversationRouter = Router();

conversationRouter.get(
  "/",
  authenticateAccessToken,
  validateGetConversations,
  getConversationsController,
);

conversationRouter.post(
  "/",
  authenticateAccessToken,
  validateCreateConversation,
  createConversationController,
);

export default conversationRouter;

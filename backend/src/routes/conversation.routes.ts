import { Router } from "express";
import { createConversationController } from "@/controllers/conversation.controller.js";
import { authenticateAccessToken } from "@/middleware/accessToken.authentication.middleware.js";
import { validateCreateConversation } from "@/middleware/createConversation.validation.middleware.js";

const conversationRouter = Router();

conversationRouter.post(
  "/",
  authenticateAccessToken,
  validateCreateConversation,
  createConversationController,
);

export default conversationRouter;

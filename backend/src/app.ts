import express from "express";
import errorHandler from "@/errors/errorHandler.js";
import cors from "cors";
import authRouter from "@/routes/auth.routes.js";
import { createConversationRouter } from "@/routes/conversation.routes.js";
import userRouter from "@/routes/user.routes.js";
import type { MessageCreatedPublisher } from "@/types/websocket.types.js";

const noopMessageCreatedPublisher: MessageCreatedPublisher = () => undefined;

export const createApp = ({
  publishMessageCreated = noopMessageCreatedPublisher,
}: {
  publishMessageCreated?: MessageCreatedPublisher;
} = {}) => {
  const app = express();
  const conversationRouter = createConversationRouter(publishMessageCreated);

  app
    .use(express.json())
    .use(express.urlencoded({ extended: true }))
    .use(cors())
    .use("/auth", authRouter)
    .use("/conversations", conversationRouter)
    .use("/users", userRouter)

    .use(errorHandler);

  return app;
};

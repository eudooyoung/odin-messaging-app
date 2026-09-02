import BadRequestError from "@/errors/badRequestError.js";
import { getConversationParamsSchema } from "@/schemas/conversation.schema.js";
import { createMessageSchema } from "@/schemas/message.schema";
import type { CreateMessageHandler } from "@/types/handler.types.js";

export const validateCreateMessage: CreateMessageHandler = (req, res, next) => {
  const paramsResult = getConversationParamsSchema.safeParse(req.params);
  const bodyResult = createMessageSchema.safeParse(req.body);

  if (!paramsResult.success || !bodyResult.success) {
    return next(new BadRequestError("Invalid message input", "INVALID_MESSAGE_INPUT"));
  }

  res.locals.conversationId = paramsResult.data.id;
  req.body = bodyResult.data;
  next();
};
